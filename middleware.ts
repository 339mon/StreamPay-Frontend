import { NextRequest, NextResponse } from 'next/server';
import { validateConfig } from './app/lib/config/index';
import { buildAllowedOriginSet, isOriginAllowed, DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS, DEFAULT_CORS_MAX_AGE_SECONDS } from './app/lib/cors';
import {
  REQUEST_FINGERPRINT_HEADER,
  captureRequestFingerprint,
} from './lib/fingerprint';
import {
  checkRequestBodySize,
  buildLimitsConfig,
} from './lib/bodySize';
import { touchLastSeenFromRequest } from './lib/lastSeen';
import { getChaosConfig, applyChaos } from './lib/chaos';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, isValidCsrfToken, verifyCsrf } from './lib/csrf';


// ---------------------------------------------------------------------------
// Request body size cap
// ---------------------------------------------------------------------------
//
// Supports per-route body size limits:
//  - Default routes: 256 KB (override via MAX_STREAM_BODY_BYTES)
//  - Webhook routes (/api/webhooks/*): 1 MB (override via MAX_WEBHOOK_BODY_BYTES)
//
// The check is intentionally O(1): we read the Content-Length header rather
// than buffering the body.  Clients that omit Content-Length are allowed
// through — the application layer is responsible for streaming limits.
//
// Only write methods (POST, PUT, PATCH) are checked; safe methods (GET, HEAD,
// OPTIONS, DELETE) are not expected to carry a body and are skipped.

// Build limits configuration at module initialization
const bodyLimits = buildLimitsConfig();

// Validate configuration at middleware initialization so invalid CORS settings fail early.
validateConfig();

const allowedOrigins = buildAllowedOriginSet(process.env.ALLOWED_ORIGINS);

// Chaos/fault injection config. Resolved once at module init; force-disabled in
// production by getChaosConfig regardless of env vars.
const chaosConfig = getChaosConfig();

export const config = {
  matcher: ['/api/:path*'],
};

const CANARY_HEADER_NAME = 'X-Canary';

function buildCorsHeaders(origin: string) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', DEFAULT_CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', DEFAULT_CORS_HEADERS);
  headers.set('Access-Control-Max-Age', String(DEFAULT_CORS_MAX_AGE_SECONDS));
  headers.set('Vary', 'Origin');
  return headers;
}

function getCanaryPercentage(): number {
  const rawValue = process.env.CANARY_PERCENTAGE;
  if (rawValue === undefined || rawValue.trim() === '') {
    return 0;
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.trunc(parsedValue)));
}

function getCanarySeed(request: NextRequest): string {
  return (
    request.headers.get('x-tenant-id') ??
    request.headers.get('x-user-id') ??
    request.headers.get('x-forwarded-user') ??
    request.headers.get('authorization') ??
    request.url
  );
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Deterministically bucket requests by a stable tenant/user-derived seed so
// the same identity consistently lands in the same canary cohort.
function shouldRouteToCanary(request: NextRequest): boolean {
  const percentage = getCanaryPercentage();
  if (percentage <= 0) {
    return false;
  }

  if (percentage >= 100) {
    return true;
  }

  const seed = getCanarySeed(request);
  const bucket = hashSeed(seed) % 100;
  return bucket < percentage;
}

function setCanaryHeader(headers: Headers, isCanary: boolean) {
  if (isCanary) {
    headers.set(CANARY_HEADER_NAME, 'true');
  }
}

function shouldEnforceBodySizeLimit(request: NextRequest | Request): boolean {
  const pathname = 'nextUrl' in request && request.nextUrl?.pathname
    ? request.nextUrl.pathname
    : new URL(request.url).pathname;

  return pathname === '/api/v2/streams' || pathname.startsWith('/api/v2/streams/') || pathname.startsWith('/api/webhooks');
}

function getCookieValue(request: NextRequest | Request, name: string): string | undefined {
  if ('cookies' in request && request.cookies && typeof request.cookies.get === 'function') {
    const cookieObj = request.cookies.get(name);
    if (cookieObj && typeof cookieObj === 'object' && 'value' in cookieObj) {
      return cookieObj.value;
    }
    if (typeof cookieObj === 'string') {
      return cookieObj;
    }
  }
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [k, v] = cookie.split('=');
    if (k === name) return v;
  }
  return undefined;
}

function setCookie(response: NextResponse, name: string, value: string) {
  if (response.cookies && typeof response.cookies.set === 'function') {
    response.cookies.set(name, value, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });
  } else {
    const cookieOptions = [
      `${name}=${value}`,
      'Path=/',
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    response.headers.append('Set-Cookie', cookieOptions);
  }
}

export async function middleware(request: NextRequest) {
  const fingerprint = await captureRequestFingerprint(request);
  touchLastSeenFromRequest(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_FINGERPRINT_HEADER, fingerprint);

  const isCanary = shouldRouteToCanary(request);
  if (isCanary) {
    requestHeaders.set(CANARY_HEADER_NAME, 'true');
  }

  const origin = request.headers.get('origin');
  let isAllowed = false;

  // ------------------------------------------------------------------
  // 1. Request body size cap (path-scoped, O(1) — reads Content-Length)
  // ------------------------------------------------------------------
  const sizeError = shouldEnforceBodySizeLimit(request)
    ? checkRequestBodySize(request, bodyLimits)
    : null;
  if (sizeError !== null) {
    sizeError.headers.set(REQUEST_FINGERPRINT_HEADER, fingerprint);
    setCanaryHeader(sizeError.headers, isCanary);
    return sizeError;
  }

  // ------------------------------------------------------------------
  // 1b. Chaos / fault injection (dev & staging only)
  // ------------------------------------------------------------------
  // No-op unless CHAOS_ENABLED=true and NODE_ENV !== production. Injects
  // random latency and/or a configurable error status to exercise client
  // retry/timeout paths. OPTIONS preflight is excluded so CORS still works.
  if (chaosConfig.enabled && request.method !== 'OPTIONS') {
    const outcome = await applyChaos(chaosConfig);
    if (outcome.injectedStatus !== undefined) {
      return NextResponse.json(
        {
          error: {
            code: 'CHAOS_INJECTED',
            message: 'Synthetic fault injected by chaos middleware.',
          },
        },
        {
          status: outcome.injectedStatus,
          headers: {
            [REQUEST_FINGERPRINT_HEADER]: fingerprint,
            'X-Chaos-Injected': 'error',
          },
        },
      );
    }
  }

  // ------------------------------------------------------------------
  // 2. CORS — reject disallowed origins with structured error envelope
  // ------------------------------------------------------------------
  const origin = request.headers.get('origin');
  let originAllowed = false;

  if (origin) {
    originAllowed = isOriginAllowed(origin, allowedOrigins);

    if (!originAllowed) {
      const requestId =
        (request.headers.get('x-request-id') as string) ??
        `req_${Date.now().toString(36)}`;

      console.warn(
        JSON.stringify({
          type: 'cors.rejection',
          origin,
          method: request.method,
          pathname: request.nextUrl?.pathname ?? '',
          request_id: requestId,
        })
      );

      const errorResponse = NextResponse.json(
        {
          error: {
            code: 'CORS_ORIGIN_DISALLOWED',
            message: `Origin '${origin}' is not allowed.`,
            request_id: requestId,
          },
        },
        { status: 403 }
      );
      errorResponse.headers.set(REQUEST_FINGERPRINT_HEADER, fingerprint);
      errorResponse.headers.set('Vary', 'Origin');
      setCanaryHeader(errorResponse.headers, isCanary);
      return errorResponse;
    }

    // Origin is allowed
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, {
        status: 204,
        headers: buildCorsHeaders(origin),
      });
      setCanaryHeader(response.headers, isCanary);
      return response;
    }
  } else {
    // No origin header — no CORS processing needed
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      setCanaryHeader(response.headers, isCanary);
      return response;
    }
  }

  // ------------------------------------------------------------------
  // 2b. CSRF Protection — double-submit token check for state-changing routes
  // ------------------------------------------------------------------
  const requestPathname = 'nextUrl' in request && request.nextUrl?.pathname
    ? request.nextUrl.pathname
    : new URL(request.url).pathname;

  const isWebhook = requestPathname === '/api/webhooks' || requestPathname.startsWith('/api/webhooks/');
  const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const isStateChanging = STATE_CHANGING_METHODS.includes(request.method);

  if (!isWebhook) {
    if (isStateChanging) {
      const cookieToken = getCookieValue(request, CSRF_COOKIE_NAME);
      const headerToken = request.headers.get(CSRF_HEADER_NAME);

      if (!verifyCsrf(cookieToken, headerToken)) {
        const requestId =
          (request.headers.get('x-request-id') as string) ??
          `req_${Date.now().toString(36)}`;

        console.warn(
          JSON.stringify({
            type: 'csrf.rejection',
            method: request.method,
            pathname: requestPathname,
            request_id: requestId,
            has_cookie: !!cookieToken,
            has_header: !!headerToken,
          })
        );

        const errorResponse = NextResponse.json(
          {
            error: {
              code: 'CSRF_TOKEN_INVALID',
              message: 'CSRF token validation failed.',
              request_id: requestId,
            },
          },
          { status: 403 }
        );
        errorResponse.headers.set(REQUEST_FINGERPRINT_HEADER, fingerprint);
        setCanaryHeader(errorResponse.headers, isCanary);
        if (originAllowed) {
          errorResponse.headers.set('Access-Control-Allow-Origin', origin!);
          errorResponse.headers.set('Vary', 'Origin');
        }
        return errorResponse;
      }
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  setCanaryHeader(response.headers, isCanary);

  if (originAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin!);
    response.headers.set('Vary', 'Origin');
  }

  // Set CSRF cookie for safe methods or if we need to initialize it
  if (!isWebhook && !isStateChanging) {
    const cookieToken = getCookieValue(request, CSRF_COOKIE_NAME);
    if (!isValidCsrfToken(cookieToken)) {
      const newCsrfToken = generateCsrfToken();
      setCookie(response, CSRF_COOKIE_NAME, newCsrfToken);
    }
  }

  return response;
}

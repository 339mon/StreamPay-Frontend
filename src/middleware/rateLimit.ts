import type { NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIdentity,
  rateLimitResponse,
} from "@/app/lib/rate-limit";
import type { ClientIdentity } from "@/app/lib/rate-limit";
import { getLimitForRoute } from "@/app/lib/rate-limit-config";
import { recordRequest, recordThrottle } from "@/app/lib/rate-limit-metrics";

export type { ClientIdentity };
export { getClientIdentity };

function getRequestUrl(request: Request, fallbackPath: string): URL {
  try {
    return request.url ? new URL(request.url) : new URL(`http://localhost${fallbackPath}`);
  } catch {
    return new URL(`http://localhost${fallbackPath}`);
  }
}

/**
 * Generic per-user rate-limit guard for API routes.
 *
 * Identity resolution priority: API key > JWT wallet sub > IP address.
 * Returns a `NextResponse` with 429 + Retry-After when the caller's bucket
 * is exhausted, or `null` when the request may proceed.
 */
export async function applyRateLimit(
  request: Request,
  routeName: string,
  method: "GET" | "POST" | "DELETE" = "GET",
): Promise<NextResponse | null> {
  const url = getRequestUrl(request, `/api/${routeName}`);
  const limitType = getLimitForRoute(method, url.pathname);
  const identity = getClientIdentity(request);
  const result = await checkRateLimit(identity, limitType);

  if (!result.allowed) {
    recordThrottle(url.pathname, limitType, identity.type, identity.displayValue);
    return rateLimitResponse(result.retryAfter!) as unknown as NextResponse;
  }

  recordRequest(url.pathname);
  return null;
}

export async function streamsRateLimit(
  request: Request,
  method: "GET" | "POST" | "DELETE",
  path: string,
): Promise<{ allowed: true; response?: undefined } | { allowed: false; response: NextResponse }> {
  const url = getRequestUrl(request, path);
  const limitType = getLimitForRoute(method, url.pathname);
  const identity = getClientIdentity(request);
  const result = await checkRateLimit(identity, limitType);

  if (!result.allowed) {
    recordThrottle(url.pathname, limitType, identity.type, identity.displayValue);
    return { allowed: false, response: rateLimitResponse(result.retryAfter!) as unknown as NextResponse };
  }

  recordRequest(url.pathname);
  return { allowed: true };
}

/**
 * src/middleware/rateLimit.ts
 *
 * Thin middleware adapter that exposes the per-user rate-limiting logic
 * from `app/lib/rate-limit.ts` as a reusable Next.js route-handler helper.
 *
 * Design notes
 * ─────────────
 * • Identity resolution priority: API key → JWT wallet sub → IP address.
 * • Uses the token-bucket store from `app/lib/rate-limit-store.ts` so all
 *   routes share a single store instance (and can be reset in tests).
 * • Emits structured log events and updates in-process metrics counters so
 *   the `/api/metrics` endpoint can surface throttle rates to operators.
 * • Returns the standardised error envelope (`{ error: { code, message,
 *   request_id } }`) with `Retry-After` and `X-RateLimit-*` headers.
 */

import { NextResponse } from "next/server";
import {
  getClientIdentity,
  checkRateLimit,
  rateLimitResponse,
  type ClientIdentity,
} from "@/app/lib/rate-limit";
import { getLimitForRoute, type LimitType } from "@/app/lib/rate-limit-config";
import { recordThrottle, recordRequest } from "@/app/lib/rate-limit-metrics";
import { logger, getCorrelationContext } from "@/app/lib/logger";

export type { ClientIdentity, LimitType };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Applies per-user rate limiting to a route handler.
 *
 * Usage in a Next.js route handler:
 * ```ts
 * import { applyRateLimit } from '@/src/middleware/rateLimit';
 *
 * export async function GET(request: Request) {
 *   const limited = await applyRateLimit(request);
 *   if (limited) return limited;
 *   // … normal handler logic …
 * }
 * ```
 *
 * @param request  The incoming `Request` object.
 * @param limitType Optional override; defaults to the route+method lookup in
 *                  `getLimitForRoute`.  Pass `"reconciliation"` explicitly for
 *                  the reconciliation endpoint so it can have its own budget.
 * @returns `NextResponse` with status 429 when throttled, otherwise `null`
 *          (the route handler should continue normally).
 */
export async function applyRateLimit(
  request: Request,
  limitType?: LimitType,
): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const route = url.pathname;
  const method = request.method ?? "GET";

  // Resolve which limit tier to apply (explicit override wins).
  const resolvedLimitType: LimitType = limitType ?? getLimitForRoute(method, route);

  // Identify the calling party.
  const identity = getClientIdentity(request);

  // Record every attempt for throughput metrics.
  recordRequest(route);

  // Check the token bucket.
  const result = await checkRateLimit(identity, resolvedLimitType);

  if (!result.allowed) {
    const correlationCtx = getCorrelationContext();

    // Emit a structured log entry with correlation IDs so the throttle event
    // can be correlated with upstream request logs.
    logger.warn("Rate limit exceeded", {
      route,
      method,
      limitType: resolvedLimitType,
      identityType: identity.type,
      identity: identity.displayValue,
      retryAfter: result.retryAfter,
      request_id: correlationCtx?.request_id,
      correlation_id: correlationCtx?.correlation_id,
    });

    // Update metrics counters.
    recordThrottle(route, resolvedLimitType, identity.type, identity.displayValue);

    return rateLimitResponse(result.retryAfter!);
  }

  return null;
}

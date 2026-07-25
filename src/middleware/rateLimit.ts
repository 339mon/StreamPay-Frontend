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

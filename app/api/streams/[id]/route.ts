import { NextResponse } from "next/server";
import { db, getStore } from "@/app/lib/db";
import { computeETag, ifNoneMatchMatches } from "@/app/lib/etag";
import { getCorrelationContext } from "@/app/lib/logger";
import { checkRateLimit, getClientIdentity, rateLimitResponse } from "@/app/lib/rate-limit";
import { getLimitForRoute } from "@/app/lib/rate-limit-config";
import { recordRequest, recordThrottle } from "@/app/lib/rate-limit-metrics";
import { streamCache } from "@/app/lib/cache";

type Context = { params: Promise<{ id: string }> };

/**
 * Headers we attach to every successful stream GET response.
 *
 * - `ETag`: strong validator; SHA-256 over a canonical serialization of the
 *   stream + tenant, so any change to the resource (or a tenant swap) flips it.
 * - `Cache-Control: private, max-age=0, must-revalidate`:
 *     • `private` — never let a shared cache (e.g. CDN) reuse the response
 *       since the body is tenant-scoped.
 *     • `max-age=0, must-revalidate` — forces intermediaries to revalidate via
 *       ETag on every request instead of trusting the freshness lifetime.
 * - `X-Cache`: HIT/MISS observability for the in-memory stream cache.
 */
const CACHE_CONTROL_PRIVATE_REVALIDATE = "private, max-age=0, must-revalidate";

function buildCacheHeaders(etag: string, cacheStatus: "HIT" | "MISS"): Record<string, string> {
  return {
    ETag: etag,
    "Cache-Control": CACHE_CONTROL_PRIVATE_REVALIDATE,
    "X-Cache": cacheStatus,
  };
}

function createErrorResponse(code: string, message: string, status: number) {
  const context = getCorrelationContext();
  return NextResponse.json({ error: { code, message, request_id: context?.request_id } }, { status });
}

function errorResponse(code: string, message: string, status: number) {
  return createErrorResponse(code, message, status);
}

function getRequestUrl(request: Request, fallbackPath: string): URL {
  try {
    return request.url ? new URL(request.url) : new URL(`http://localhost${fallbackPath}`);
  } catch {
    return new URL(`http://localhost${fallbackPath}`);
  }
}

async function enforceRateLimit(request: Request, method: "GET" | "POST" | "DELETE", path: string) {
  const url = getRequestUrl(request, path);
  const limitType = getLimitForRoute(method, url.pathname);
  const identity = getClientIdentity(request);
  const result = await checkRateLimit(identity, limitType);

  if (!result.allowed) {
    recordThrottle(url.pathname, limitType, identity.type, identity.displayValue);
    return rateLimitResponse(result.retryAfter!);
  }

  recordRequest(url.pathname);
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { streamRepository } = getStore();
  const { id } = await params;
  const rateLimited = await enforceRateLimit(request, "GET", `/api/streams/${id}`);
  if (rateLimited) {
    return rateLimited;
  }

  const tenant = request.headers.get("x-tenant-id");
  if (!tenant || tenant.trim() === "") {
    return errorResponse("MISSING_TENANT", "Tenant ID header is required", 400);
  }

  // Check cache first
  const cachedStream = streamCache.get(tenant, id);
  let stream: any | null = null;
  let cacheStatus: "HIT" | "MISS" = "MISS";

  if (cachedStream) {
    stream = cachedStream;
    cacheStatus = "HIT";
  } else {
    // Fetch from DB using findOne (tenant-scoped)
    stream = db.streams.findOne ? db.streams.findOne(tenant, id) : null;
    if (!stream) {
      return errorResponse("STREAM_NOT_FOUND", `Stream '${id}' not found`, 404);
    }
    streamCache.set(tenant, id, stream);
  }

  // Compute ETag and short-circuit on `If-None-Match`.
  // Tenant is included in the digest so two tenants holding the same id
  // cannot share an ETag (defense against cross-tenant cache poisoning).
  const etag = computeETag(tenant, stream);
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatchMatches(ifNoneMatch, etag)) {
    // 304 Not Modified — RFC 7232: empty body, but Cache-Control & ETag
    // must still be present so the client can update its revalidation state.
    return new NextResponse(null, {
      status: 304,
      headers: buildCacheHeaders(etag, cacheStatus),
    });
  }

  return NextResponse.json(
    { data: stream, links: { self: `/api/v1/streams/${id}` } },
    { headers: buildCacheHeaders(etag, cacheStatus) }
  );
}

export async function POST(
  request: Request,
  { params }: Context
) {
  const { id } = await params;
  const rateLimited = await enforceRateLimit(request, "POST", `/api/streams/${id}`);
  if (rateLimited) {
    return rateLimited;
  }

  const tenant = request.headers.get("x-tenant-id");
  if (!tenant || tenant.trim() === "") {
    return errorResponse("MISSING_TENANT", "Tenant ID header is required", 400);
  }

  const stream = db.streams.findOne ? db.streams.findOne(tenant, id) : null;
  if (!stream) {
    return errorResponse("STREAM_NOT_FOUND", `Stream '${id}' not found`, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  const updatedStream = {
    ...stream,
    ...body,
    updatedAt: new Date().toISOString(),
  };

  db.streams.set(id, updatedStream);

  // Invalidate cache BEFORE returning response (also implicitly invalidates
  // any stale ETag the client may be holding for this resource).
  streamCache.invalidate(tenant, id);

  return NextResponse.json({ data: updatedStream });
}

export async function DELETE(request: Request, { params }: Context) {
  const { streamRepository } = getStore();
  const { id } = await params;
  const rateLimited = await enforceRateLimit(request, "DELETE", `/api/streams/${id}`);
  if (rateLimited) {
    return rateLimited;
  }

  const tenant = request.headers.get("x-tenant-id");
  if (!tenant || tenant.trim() === "") {
    return errorResponse("MISSING_TENANT", "Tenant ID header is required", 400);
  }

  const stream = db.streams.findOne ? db.streams.findOne(tenant, id) : null;
  if (!stream) {
    return errorResponse("STREAM_NOT_FOUND", `Stream '${id}' not found`, 404);
  }

  if (stream.status === "active" || stream.status === "paused") {
    return errorResponse(
      "STREAM_INACTIVE_STATE",
      "Cannot delete a stream that is active or paused. Stop it first.",
      409
    );
  }

  db.streams.delete(id);

  // Invalidate cache BEFORE returning response.
  streamCache.invalidate(tenant, id);

  return new NextResponse(null, { status: 204 });
}

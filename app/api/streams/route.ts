import { NextResponse } from "next/server";
import {
  checkIdempotency,
  computeFingerprint,
  decodeCursor,
  encodeCursor,
  getStore,
  idempotencyToken,
  setIdempotency,
} from "@/app/lib/db";
import { getCorrelationContext, logger } from "@/app/lib/logger";
import { logAccessEvent } from "@/src/middleware/accessLog";
import { streamsRateLimit } from "@/src/middleware/rateLimit";
import { checkTokenAllowed, normaliseToken } from "@/app/lib/token-allowlist";
import {
  validateCreateStreamBody,
  validateListStreamsQuery,
} from "@/app/lib/stream-validation";
import type { Stream } from "@/app/types/openapi";
import { createCacheHeaders, createStrongEtag, isIfNoneMatchMatch } from "@/src/middleware/etag";

function errorResponse(code: string, message: string, status: number) {
  return createErrorResponse(code, message, status);
}

function createErrorResponse(code: string, message: string, status: number) {
  const context = getCorrelationContext();
  return NextResponse.json({ error: { code, message, request_id: context?.request_id } }, { status });
}

function getRequestUrl(request: Request, fallbackPath: string): URL {
  try {
    return request.url ? new URL(request.url) : new URL(`http://localhost${fallbackPath}`);
  } catch {
    return new URL(`http://localhost${fallbackPath}`);
  }
}

function getHeader(request: Request, name: string): string | null {
  return request.headers?.get?.(name) ?? null;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { streamRepository } = getStore();
  const url = getRequestUrl(request, "/api/streams");
  const path = url.pathname;
  const logAccess = (status: number, extra?: Record<string, unknown>) =>
    logAccessEvent({ method: "GET", path, status, durationMs: Date.now() - startedAt, ...extra });

  const rateLimitResult = await streamsRateLimit(request, "GET", "/api/streams");
  if (!rateLimitResult.allowed) {
    logAccess(429, { errorCode: "rate_limit_exceeded" });
    return rateLimitResult.response;
  }

  const { searchParams } = url;
  const rawQuery: Record<string, string> = {};
  for (const key of ["limit", "status", "cursor"] as const) {
    const value = searchParams.get(key);
    if (value !== null) {
      rawQuery[key] = value;
    }
  }

  const { errors: queryErrors, values: query } = validateListStreamsQuery(rawQuery);
  if (queryErrors.length > 0) {
    logger.warn("Stream list validation failed", { errors: queryErrors });
    logAccess(422, { errorCode: "VALIDATION_ERROR" });
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more query parameters are invalid.",
          details: queryErrors,
          request_id: getCorrelationContext()?.request_id,
        },
      },
      { status: 422 },
    );
  }

  const cursor = query.cursor ?? null;
  const status = query.status ?? null;
  const limit = query.limit ?? 20;

  let streams = Array.from(streamRepository.streams.values()).sort((left, right) => {
    const timeCompare = left.createdAt.localeCompare(right.createdAt);
    return timeCompare !== 0 ? timeCompare : left.id.localeCompare(right.id);
  });

  if (status) {
    streams = streams.filter((stream) => stream.status === status);
  }

  if (cursor) {
    let cursorId: string;
    try {
      cursorId = decodeCursor(cursor);
    } catch {
      logAccess(422, { errorCode: "INVALID_CURSOR" });
      return errorResponse("INVALID_CURSOR", "Malformed cursor", 422);
    }
    const cursorIndex = streams.findIndex((stream) => stream.id === cursorId);
    if (cursorIndex >= 0) {
      streams = streams.slice(cursorIndex + 1);
    }
  }

  const paginatedStreams = streams.slice(0, limit);
  const hasNext = streams.length > limit;
  const nextCursor =
    hasNext && paginatedStreams.length > 0
      ? encodeCursor(paginatedStreams[paginatedStreams.length - 1].id)
      : null;

  const payload = {
    data: paginatedStreams,
    links: { self: `/api/v1/streams?limit=${limit}` },
    meta: { hasNext, nextCursor, total: streams.length },
  };
  const etag = createStrongEtag(payload);

  if (isIfNoneMatchMatch(etag, getHeader(request, "if-none-match"))) {
    logAccess(304);
    return new NextResponse(null, {
      status: 304,
      headers: createCacheHeaders(etag),
    });
  }

  logger.info("Streams listed successfully", {
    count: paginatedStreams.length,
    total: streamRepository.streams.size,
  });
  logAccess(200, { count: paginatedStreams.length, total: streamRepository.streams.size });

  const response = NextResponse.json(payload);
  for (const [name, value] of Object.entries(createCacheHeaders(etag))) {
    response.headers.set(name, value);
  }
  return response;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const { idempotencyStore, streamRepository } = getStore();
  const path = getRequestUrl(request, "/api/streams").pathname;
  const logAccess = (status: number, extra?: Record<string, unknown>) =>
    logAccessEvent({ method: "POST", path, status, durationMs: Date.now() - startedAt, ...extra });

  const rateLimitResult = await streamsRateLimit(request, "POST", "/api/streams");
  if (!rateLimitResult.allowed) {
    logAccess(429, { errorCode: "rate_limit_exceeded" });
    return rateLimitResult.response;
  }

  const url = getRequestUrl(request, "/api/streams");
  const idempotencyKey = getHeader(request, "Idempotency-Key");
  const token = idempotencyKey ? idempotencyToken("streams.create", idempotencyKey) : null;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    logAccess(400, { errorCode: "INVALID_REQUEST" });
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  const fingerprint = computeFingerprint("POST", "/api/streams", body);

  if (token) {
    const cached = checkIdempotency(idempotencyStore, token, fingerprint);
    if (cached) {
      if (!cached.ok) {
        logAccess(409, { errorCode: "IDEMPOTENCY_CONFLICT" });
        return NextResponse.json(
          { error: { code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key has been used with a different request." } },
          { status: 409 },
        );
      }
      logAccess(cached.status, { idempotent: true });
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  // ── Schema validation (shared) ────────────────────────────────────────
  const validationErrors = validateCreateStreamBody(body);
  if (validationErrors.length > 0) {
    logger.warn("Stream creation validation failed", {
      errors: validationErrors,
    });
    logAccess(422, { errorCode: "VALIDATION_ERROR" });
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more fields are invalid.",
          details: validationErrors,
          request_id: getCorrelationContext()?.request_id,
        },
      },
      { status: 422 },
    );
  }

  const { rate, recipient, schedule, token: rawToken } = body as {
    rate?: string;
    recipient?: string;
    schedule?: string;
    token?: string;
  };

  const rateValue = rate ?? "";
  const recipientValue = recipient ?? "";
  const scheduleValue = schedule ?? "";
  const tokenStr = rawToken?.trim() || "XLM";
  let normalisedToken: string;
  try {
    normalisedToken = normaliseToken(tokenStr);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logAccess(422, { errorCode: "INVALID_TOKEN" });
    return createErrorResponse("INVALID_TOKEN", `Invalid token format: ${msg}`, 422);
  }

  const allowlistResult = await checkTokenAllowed(normalisedToken);
  if (!allowlistResult.accepted) {
    logger.warn("Stream creation rejected: token not in allowlist", { token: normalisedToken });
    logAccess(422, { errorCode: "TOKEN_NOT_ALLOWED" });
    return createErrorResponse("TOKEN_NOT_ALLOWED", allowlistResult.reason, 422);
  }

  const id = `stream-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const newStream: Stream = {
    createdAt: now,
    id,
    nextAction: "start",
    rate: rateValue,
    recipient: recipientValue,
    schedule: scheduleValue,
    status: "draft",
    updatedAt: now,
    token: normalisedToken,
  };

  streamRepository.streams.set(id, newStream);
  const payload = { data: newStream, links: { self: `/api/v1/streams/${id}` } };

  if (token) {
    setIdempotency(idempotencyStore, token, fingerprint, 201, payload);
  }

  logAccess(201, { streamId: id });
  return NextResponse.json(payload, { status: 201 });
}

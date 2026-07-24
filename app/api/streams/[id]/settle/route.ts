import { NextRequest, NextResponse } from "next/server";
import { db, withLock, checkIdempotency, setIdempotency, computeFingerprint, idempotencyToken } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { auditLogStore } from "@/app/lib/audit-log";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const resolvedParams = "then" in context.params ? await context.params : context.params;
  const streamId = resolvedParams.id;

  const idempotencyHeader = request.headers.get("idempotency-key");
  const lockKey = `stream:${streamId}`;

  return withLock(lockKey, async () => {
    if (idempotencyHeader) {
      const token = idempotencyToken("settle", `${streamId}:${idempotencyHeader}`);
      const fp = computeFingerprint("POST", `/api/streams/${streamId}/settle`, {});
      const cached = checkIdempotency(db.idempotency, token, fp);
      if (cached) {
        if ("conflict" in cached && cached.conflict) {
          return NextResponse.json(
            { code: "IDEMPOTENCY_CONFLICT", error: "Idempotency key mismatch", message: "Idempotency key mismatch" },
            { status: 409 }
          );
        }
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    const stream = db.streams[streamId];
    if (!stream) {
      return NextResponse.json(
        { code: "STREAM_NOT_FOUND", error: `Stream '${streamId}' not found`, message: `Stream '${streamId}' not found` },
        { status: 404 }
      );
    }

    if (stream.status !== "active") {
      return NextResponse.json(
        { code: "INVALID_STATE", error: "Stream must be active to settle", message: "Stream must be active to settle" },
        { status: 409 }
      );
    }

    stream.updatedAt = new Date().toISOString();
    db.streams[streamId] = stream;

    const requestId = request.headers.get("x-request-id") || "";
    const actorId = request.headers.get("x-streampay-actor-id") || request.headers.get("x-actor-id") || "ops-admin-17";
    const actorRole = request.headers.get("x-streampay-actor-role") || "admin";
    const fakeTxHash = `fake-tx-${Date.now()}`;

    // Record into auditLogStore
    if (typeof auditLogStore?.append === "function") {
      auditLogStore.append({
        requestId,
        action: "stream.settle",
        actor: { id: actorId, role: actorRole },
        target: { id: streamId, type: "stream" },
        metadata: { settlementTxHash: fakeTxHash },
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({
      message: "Stream settled successfully",
      streamId,
      action: "settle",
      status: "success",
    });

    const responseBody = { message: "Stream settled successfully", stream };

    if (idempotencyHeader) {
      const token = idempotencyToken("settle", `${streamId}:${idempotencyHeader}`);
      const fp = computeFingerprint("POST", `/api/streams/${streamId}/settle`, {});
      setIdempotency(db.idempotency, token, fp, 200, responseBody);
    }

    return NextResponse.json(responseBody, { status: 200 });
  });
}

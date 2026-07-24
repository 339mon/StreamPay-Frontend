import { NextRequest, NextResponse } from "next/server";
import { db, withLock, checkIdempotency, setIdempotency, computeFingerprint, idempotencyToken } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

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
      const token = idempotencyToken("pause", `${streamId}:${idempotencyHeader}`);
      const fp = computeFingerprint("POST", `/api/streams/${streamId}/pause`, {});
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

    if (stream.status === "paused") {
      return NextResponse.json(
        { code: "INVALID_STATE", error: "Stream is already paused", message: "Stream is already paused" },
        { status: 409 }
      );
    }

    if (stream.status === "cancelled" || stream.status === "completed") {
      return NextResponse.json(
        { code: "INVALID_STATE", error: "Stream has already ended", message: "Stream has already ended" },
        { status: 409 }
      );
    }

    if ((stream as any).requiresApproval && !(stream as any).approvalGranted) {
      const responseBody = { approvalRequired: true, status: "pendingApproval" };
      if (idempotencyHeader) {
        const token = idempotencyToken("pause", `${streamId}:${idempotencyHeader}`);
        const fp = computeFingerprint("POST", `/api/streams/${streamId}/pause`, {});
        setIdempotency(db.idempotency, token, fp, 202, responseBody);
      }
      return NextResponse.json(responseBody, { status: 202 });
    }

    stream.status = "paused";
    stream.updatedAt = new Date().toISOString();
    db.streams[streamId] = stream;

    logger.info("Stream paused successfully");

    const responseBody = { message: "Stream paused successfully", stream };

    if (idempotencyHeader) {
      const token = idempotencyToken("pause", `${streamId}:${idempotencyHeader}`);
      const fp = computeFingerprint("POST", `/api/streams/${streamId}/pause`, {});
      setIdempotency(db.idempotency, token, fp, 200, responseBody);
    }

    return NextResponse.json(responseBody, { status: 200 });
  });
}

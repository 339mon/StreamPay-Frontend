import { NextRequest, NextResponse } from "next/server";
import { errorResponse, ErrorCode } from "@/app/lib/errors";
import { appendToOutbox, getOutboxStore, outboxDrainWorker } from "@/lib/outbox";
import type { WebhookEndpoint, WebhookEvent } from "@/app/lib/webhook-delivery";

/**
 * POST /api/webhooks/dlq
 *
 * Receives dead-letter-queue webhook events for reprocessing.
 *
 * When the request body contains a structured `{ endpoint, event }` payload,
 * the event is recorded in the transactional outbox so the drain worker can
 * deliver it reliably — surviving any crash between receipt and actual delivery.
 *
 * When the body is a generic JSON object (legacy / unstructured), the endpoint
 * still acknowledges receipt (backward-compatible).
 *
 * Returns 200 on success, or the canonical error envelope on failure.
 */
export async function POST(req: NextRequest) {
  try {
    // Let json() throws propagate to the outer catch → 500 WEBHOOK_PROCESSING_FAILED.
    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(ErrorCode.BAD_REQUEST, "Request body must be a JSON object.", 400);
    }

    // If the body has structured endpoint+event fields, record it in the
    // transactional outbox and trigger a best-effort drain.
    if (hasEndpoint(body) && hasEvent(body)) {
      const endpoint = (body as { endpoint: WebhookEndpoint }).endpoint;
      const event = (body as { event: WebhookEvent }).event;

      const entry = appendToOutbox({ endpoint, event, store: getOutboxStore() });

      // Best-effort synchronous drain — errors are swallowed inside drain().
      outboxDrainWorker.drain().catch(() => {});

      return NextResponse.json({ received: true, outboxId: entry.id }, { status: 200 });
    }

    // Legacy / unstructured body: acknowledge receipt without outbox integration.
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.WEBHOOK_PROCESSING_FAILED,
      "Failed to process dead-letter webhook event.",
      500,
    );
  }
}

// ── Type-guard helpers ────────────────────────────────────────────────────────

function hasEndpoint(body: object): boolean {
  const e = (body as Record<string, unknown>).endpoint;
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as Record<string, unknown>).id === "string" &&
    typeof (e as Record<string, unknown>).url === "string" &&
    typeof (e as Record<string, unknown>).maxRetries === "number"
  );
}

function hasEvent(body: object): boolean {
  const e = (body as Record<string, unknown>).event;
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as Record<string, unknown>).id === "string" &&
    typeof (e as Record<string, unknown>).eventType === "string" &&
    typeof (e as Record<string, unknown>).streamId === "string" &&
    typeof (e as Record<string, unknown>).timestamp === "string"
  );
}

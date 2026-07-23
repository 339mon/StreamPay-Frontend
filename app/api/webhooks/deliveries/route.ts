import { NextRequest, NextResponse } from "next/server";
import { errorResponse, ErrorCode } from "@/app/lib/errors";
import { webhookDeliveryStore } from "@/app/lib/webhook-delivery-store";
import { getOutboxStore } from "@/lib/outbox";

/**
 * GET /api/webhooks/deliveries
 *
 * Returns a paginated list of webhook delivery attempts alongside a snapshot
 * of the current outbox queue (pending / dispatched / failed entries).
 *
 * Query params:
 *   - limit  (number, default 20, max 100)
 *   - cursor (opaque pagination cursor)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const rawLimit = searchParams.get("limit");
    const cursor = searchParams.get("cursor") ?? undefined;

    const limit = rawLimit !== null ? parseInt(rawLimit, 10) : 20;

    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      return errorResponse(
        ErrorCode.BAD_REQUEST,
        "Query param 'limit' must be an integer between 1 and 100.",
        400,
      );
    }

    // Delivery records from the in-process WebhookDeliveryStore.
    const allDeliveries = webhookDeliveryStore.getAllDeliveries();
    const deliveries = allDeliveries.slice(0, limit);

    // Outbox snapshot: current status of all entries in the transactional outbox.
    const outboxEntries = getOutboxStore().list();
    const outbox = {
      total: outboxEntries.length,
      pending: outboxEntries.filter((e) => e.status === "pending").length,
      dispatched: outboxEntries.filter((e) => e.status === "dispatched").length,
      failed: outboxEntries.filter((e) => e.status === "failed").length,
      entries: outboxEntries.slice(0, limit),
    };

    return NextResponse.json({ deliveries, cursor: cursor ?? null, limit, outbox }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.DELIVERY_FETCH_FAILED,
      "Failed to retrieve webhook deliveries.",
      500,
    );
  }
}

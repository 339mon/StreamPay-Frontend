import { NextResponse } from "next/server";
import { errorResponse, ErrorCode } from "@/app/lib/errors/server";
import {
  deriveHealthStatus,
  type WebhookDeliveryStats,
  type WebhookHealthResponse,
  type WebhookSubscriptionStats,
} from "./health";

/**
 * GET /api/webhooks/health
 *
 * Returns the health status of the webhook delivery system along with
 * per-subscription delivery statistics.
 *
 * Response shape:
 * ```json
 * {
 *   "status": "ok",
 *   "checked_at": "2024-01-01T00:00:00.000Z",
 *   "subscriptions": {
 *     "total": 0,
 *     "active": 0,
 *     "degraded": 0,
 *     "disabled": 0
 *   },
 *   "delivery_stats": {
 *     "total": 0,
 *     "delivered": 0,
 *     "failed": 0,
 *     "pending": 0,
 *     "dlq": 0,
 *     "success_rate_pct": 100
 *   }
 * }
 * ```
 */

export async function GET() {
  try {
    // TODO: replace stubs with real data-layer queries once persistence is wired up.
    const subscriptions: WebhookSubscriptionStats = {
      total: 0,
      active: 0,
      degraded: 0,
      disabled: 0,
    };

    const delivery_stats: WebhookDeliveryStats = {
      total: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      dlq: 0,
      success_rate_pct: 100,
    };

    const status = deriveHealthStatus(subscriptions, delivery_stats);
    const checked_at = new Date().toISOString();

    const body: WebhookHealthResponse = {
      status,
      checked_at,
      subscriptions,
      delivery_stats,
    };

    return NextResponse.json(body, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      "Failed to retrieve webhook health stats.",
      500,
    );
  }
}

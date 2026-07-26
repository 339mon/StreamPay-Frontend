import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCorrelationContext, logger } from '@/app/lib/logger';
import { encodeCompositeCursor, decodeCompositeCursor } from '@/app/lib/db';
import { withStrongEtag } from '@/src/middleware/etag';
import { applyRateLimit } from '@/src/middleware/rateLimit';
import { logAccessEvent } from '@/src/middleware/accessLog';

function errorResponse(code: string, message: string, status: number) {
  const requestId = getCorrelationContext()?.request_id ?? `req-${crypto.randomUUID()}`;
  return NextResponse.json({ error: { code, message, request_id: requestId } }, { status });
}

type ReconciliationRecord = {
  id: string;
  created_at: string;
  totalReconciled: number;
  currency: string;
  status: string;
};

/**
 * Public reconciliation overview fixtures for the FWC26 campaign.
 * Ordered by (created_at DESC, id DESC) for stable cursor pagination.
 */
const RECONCILIATION_RECORDS: ReconciliationRecord[] = [
  {
    id: 'rec-pub-3',
    created_at: '2026-07-24T12:00:00.000Z',
    totalReconciled: 900,
    currency: 'EURC',
    status: 'completed',
  },
  {
    id: 'rec-pub-2',
    created_at: '2026-07-24T11:00:00.000Z',
    totalReconciled: 300,
    currency: 'USDC',
    status: 'pending',
  },
  {
    id: 'rec-pub-1',
    created_at: '2026-07-24T10:00:00.000Z',
    totalReconciled: 1500,
    currency: 'XLM',
    status: 'completed',
  },
].sort((left, right) => {
  const timeCompare = right.created_at.localeCompare(left.created_at);
  return timeCompare !== 0 ? timeCompare : right.id.localeCompare(left.id);
});

export async function GET(request: Request) {
  // ── Per-user rate limit ─────────────────────────────────────────────────
  // Identity resolution priority: API key > JWT wallet sub > IP address.
  // Returns 429 with Retry-After when the caller's bucket is exhausted.
  const rateLimited = await applyRateLimit(request, 'reconciliation');
  if (rateLimited) return rateLimited;

  // ── Request handling ────────────────────────────────────────────────────
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const cursorParam = url.searchParams.get('cursor');

    let limit = 100;
    if (limitParam !== null) {
      limit = parseInt(limitParam, 10);
      if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
        logger.warn('Invalid limit parameter provided', { limit: limitParam });
        return errorResponse('INVALID_INPUT', 'Limit must be an integer between 1 and 1000', 400);
      }
    }

    let records = [...RECONCILIATION_RECORDS];

    if (cursorParam !== null) {
      if (cursorParam.trim() === '') {
        return errorResponse('INVALID_CURSOR', 'Malformed cursor', 422);
      }
      try {
        const decoded = decodeCompositeCursor(cursorParam);
        const cursorIndex = records.findIndex(
          (row) => row.created_at === decoded.timestamp && row.id === decoded.id,
        );
        if (cursorIndex >= 0) {
          records = records.slice(cursorIndex + 1);
        }
      } catch {
        logger.warn('Invalid cursor parameter provided', { cursor: cursorParam });
        return errorResponse('INVALID_CURSOR', 'Malformed cursor', 422);
      }
    }

    logger.info('Fetching public reconciliation overview', {
      limit,
      cursor: cursorParam ?? null,
    });

    const page = records.slice(0, limit);
    const hasNext = records.length > limit;
    const nextCursor =
      hasNext && page.length > 0
        ? encodeCompositeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
        : null;

    const responsePayload = {
      status: 'success',
      data: page,
      meta: {
        total: RECONCILIATION_RECORDS.length,
        limit,
        hasNext,
        nextCursor,
      },
    };

    const startTime = Date.now();
    const response = withStrongEtag(request, responsePayload);

    // Structured access log for observability
    logAccessEvent({
      method: 'GET',
      path: '/api/reconciliation',
      status: 200,
      durationMs: Date.now() - startTime,
      limit,
    });

    return response;
  } catch (error: any) {
    const statusCode = error.message?.includes('INVALID') ? 400 : 500;
    logAccessEvent({
      method: 'GET',
      path: '/api/reconciliation',
      status: statusCode,
      errorCode: statusCode === 400 ? 'INVALID_INPUT' : 'INTERNAL_SERVER_ERROR',
      errorMessage: error.message,
    });

    logger.error('Unexpected error in reconciliation route', { error: error.message });
    return errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', 500);
  }
}

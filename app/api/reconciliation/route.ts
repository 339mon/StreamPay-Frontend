import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCorrelationContext, logger } from '@/app/lib/logger';
import { withStrongEtag } from '@/src/middleware/etag';
import { applyRateLimit } from '@/src/middleware/rateLimit';
import { logAccessEvent } from '@/src/middleware/accessLog';

function errorResponse(code: string, message: string, status: number) {
  const requestId = getCorrelationContext()?.request_id ?? `req-${crypto.randomUUID()}`;
  return NextResponse.json({ error: { code, message, request_id: requestId } }, { status });
}

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
    
    let limit = 100;
    if (limitParam !== null) {
      limit = parseInt(limitParam, 10);
      if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
        logger.warn('Invalid limit parameter provided', { limit: limitParam });
        return errorResponse('INVALID_INPUT', 'Limit must be an integer between 1 and 1000', 400);
      }
    }

    logger.info('Fetching public reconciliation overview', { limit });

    // Mock representation of public reconciliation status for the FWC26 campaign
    const responsePayload = {
      status: 'success',
      data: [
        { id: 'rec-pub-1', totalReconciled: 1500, currency: 'XLM', status: 'completed' },
        { id: 'rec-pub-2', totalReconciled: 300, currency: 'USDC', status: 'pending' },
      ].slice(0, limit),
      meta: {
        total: 2,
        limit,
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

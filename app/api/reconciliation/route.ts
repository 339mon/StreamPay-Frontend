import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCorrelationContext, logger } from '@/app/lib/logger';
import { encodeCompositeCursor, decodeCompositeCursor } from '@/app/lib/db';
import { withStrongEtag } from '@/src/middleware/etag';
import { applyRateLimit } from '@/src/middleware/rateLimit';
import { validateReconciliationQuery } from '@/src/validators/reconciliation';
import type { ValidationError } from '@/app/lib/stream-validation';

function errorResponse(code: string, message: string, status: number) {
  const requestId = getCorrelationContext()?.request_id ?? `req-${crypto.randomUUID()}`;
  return NextResponse.json({ error: { code, message, request_id: requestId } }, { status });
}

/** 422 envelope with per-field details, matching /api/streams and /api/auth/wallet. */
function validationErrorResponse(logMessage: string, errors: ValidationError[]) {
  const requestId = getCorrelationContext()?.request_id ?? `req-${crypto.randomUUID()}`;
  logger.warn(logMessage, { errors, request_id: requestId });
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        details: errors,
        request_id: requestId,
      },
    },
    { status: 422 },
  );
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
    const rawQuery = {
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    };

    const validation = validateReconciliationQuery(rawQuery);
    if (!validation.ok) {
      return validationErrorResponse(
        'Reconciliation query validation failed',
        validation.errors,
      );
    }

    const limit = validation.data.limit ?? 100;
    const statusFilter = validation.data.status;

    logger.info('Fetching public reconciliation overview', {
      limit,
      status: statusFilter,
      request_id: getCorrelationContext()?.request_id,
    });

    // Mock representation of public reconciliation status for the FWC26 campaign
    let rows = [
      { id: 'rec-pub-1', totalReconciled: 1500, currency: 'XLM', status: 'completed' as const },
      { id: 'rec-pub-2', totalReconciled: 300, currency: 'USDC', status: 'pending' as const },
    ];

    if (statusFilter) {
      rows = rows.filter((row) => row.status === statusFilter);
    }

    const responsePayload = {
      status: 'success',
      data: rows.slice(0, limit),
      meta: {
        total: rows.length,
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

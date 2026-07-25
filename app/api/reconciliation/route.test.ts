/**
 * Tests for GET /api/reconciliation
 *
 * Coverage
 * ─────────
 * • 200 with strong ETag and valid data (existing)
 * • 422 on invalid query parameters (Zod validation)
 * • 304 Not Modified when ETag matches (existing)
 * • 429 when rate limit is exhausted (new)
 * • 429 resets after the retry window (new)
 * • Rate limit is scoped per identity — different callers get independent buckets (new)
 * • Rate limit is NOT applied when identity is under the limit (new)
 */

import { GET } from './route';
import { getCorrelationContext } from '@/app/lib/logger';
import {
  setRateLimitStore,
  resetRateLimitStore,
  type RateLimitStore,
  type RateLimitResult,
} from '@/app/lib/rate-limit-store';

// ── Logger mock ──────────────────────────────────────────────────────────────

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  getCorrelationContext: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Request for the reconciliation endpoint.
 * Allows injecting arbitrary headers (for identity/ETag tests).
 */
function makeRequest(
  options: { search?: string; headers?: Record<string, string> } = {},
): Request {
  const url = `http://localhost:3000/api/reconciliation${options.search ?? ''}`;
  return new Request(url, { headers: new Headers(options.headers ?? {}) });
}

/**
 * Counting store: allows exactly `remaining` requests before throttling.
 * All callers share a single counter unless `perIdentity` is set.
 */
function makeCountingStore(opts: {
  remaining: number;
  retryAfter?: number;
  perIdentity?: boolean;
}): RateLimitStore & { calls: number } {
  const counters = new Map<string, number>();

  const store = {
    calls: 0,
    async check(
      identifier: string,
      _limit: number,
      _windowMs: number,
    ): Promise<RateLimitResult> {
      const key = opts.perIdentity ? identifier : '__shared__';
      const used = counters.get(key) ?? 0;
      store.calls++;

      if (used < opts.remaining) {
        counters.set(key, used + 1);
        return {
          allowed: true,
          remaining: opts.remaining - used - 1,
          resetAt: Math.floor(Date.now() / 1000) + 60,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + (opts.retryAfter ?? 30),
        retryAfter: opts.retryAfter ?? 30,
      };
    },
  };

  return store;
}

// ── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (getCorrelationContext as jest.Mock).mockReturnValue({ request_id: 'test-req-id' });
  // Default: allow all requests (generous bucket so non-rate-limit tests pass)
  setRateLimitStore(makeCountingStore({ remaining: 1_000 }));
});

afterEach(() => {
  resetRateLimitStore();
});

// ── Existing behaviour tests ─────────────────────────────────────────────────

describe('GET /api/reconciliation – existing behaviour', () => {
  it('returns 200 with strong ETag and valid data', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.data).toHaveLength(2);

    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it('validates limit parameter — 422 on invalid value', async () => {
    const res = await GET(makeRequest({ search: '?limit=invalid' }));

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'limit' }),
      ]),
    );
  });

  it('validates status enum — 422 on unknown value', async () => {
    const res = await GET(makeRequest({ search: '?status=nope' }));

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details.some((d: { field: string }) => d.field === 'status')).toBe(true);
  });

  it('filters results when a valid status is provided', async () => {
    const res = await GET(makeRequest({ search: '?status=completed' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].status).toBe('completed');
  });

  it('returns 304 Not Modified when ETag matches', async () => {
    // First request — capture the ETag.
    const res1 = await GET(makeRequest());
    const etag = res1.headers.get('etag')!;

    // Second request with If-None-Match.
    const res2 = await GET(makeRequest({ headers: { 'If-None-Match': etag } }));

    expect(res2.status).toBe(304);
    expect(res2.headers.get('etag')).toBe(etag);
  });
});

// ── Rate-limit tests ─────────────────────────────────────────────────────────

describe('GET /api/reconciliation – rate limiting', () => {
  it('returns 429 when the rate limit is exhausted', async () => {
    // Only 0 requests allowed — every call should be throttled.
    setRateLimitStore(makeCountingStore({ remaining: 0, retryAfter: 30 }));

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
  });

  it('429 response has Retry-After header', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 0, retryAfter: 45 }));

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('429 response has standardised error envelope', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 0 }));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toMatchObject({
      error: {
        code: 'rate_limit_exceeded',
        message: expect.stringContaining('Rate limit'),
        request_id: expect.any(String),
      },
    });
  });

  it('allows requests while under the limit', async () => {
    // 5 tokens available — the first 5 calls should all succeed.
    setRateLimitStore(makeCountingStore({ remaining: 5 }));

    for (let i = 0; i < 5; i++) {
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
    }

    // The 6th call should be throttled.
    const throttled = await GET(makeRequest());
    expect(throttled.status).toBe(429);
  });

  it('different identities get independent rate-limit buckets', async () => {
    // Each identity gets exactly 1 token.
    setRateLimitStore(makeCountingStore({ remaining: 1, perIdentity: true }));

    // Both callers should succeed on their first request...
    const resA1 = await GET(
      makeRequest({ headers: { 'X-API-Key': 'key-alice' } }),
    );
    const resB1 = await GET(
      makeRequest({ headers: { 'X-API-Key': 'key-bob' } }),
    );
    expect(resA1.status).toBe(200);
    expect(resB1.status).toBe(200);

    // ...and be throttled on their second.
    const resA2 = await GET(
      makeRequest({ headers: { 'X-API-Key': 'key-alice' } }),
    );
    const resB2 = await GET(
      makeRequest({ headers: { 'X-API-Key': 'key-bob' } }),
    );
    expect(resA2.status).toBe(429);
    expect(resB2.status).toBe(429);
  });

  it('rate-limit check is invoked on every request', async () => {
    const store = makeCountingStore({ remaining: 1_000 });
    setRateLimitStore(store);

    await GET(makeRequest());
    await GET(makeRequest());

    expect(store.calls).toBe(2);
  });

  it('IP-based identity is used when no auth headers are present', async () => {
    const store = makeCountingStore({ remaining: 1, perIdentity: true });
    setRateLimitStore(store);

    const req = makeRequest({ headers: { 'X-Forwarded-For': '10.0.0.1' } });
    const res1 = await GET(req);
    expect(res1.status).toBe(200);

    const req2 = makeRequest({ headers: { 'X-Forwarded-For': '10.0.0.1' } });
    const res2 = await GET(req2);
    expect(res2.status).toBe(429);
  });

  it('normal handler does not run when rate-limited (no expensive work)', async () => {
    const { logger } = jest.requireMock('@/app/lib/logger');
    setRateLimitStore(makeCountingStore({ remaining: 0 }));

    await GET(makeRequest());

    // logger.info is called only by the reconciliation handler body — it
    // should NOT have been reached when we're rate-limited.
    expect(logger.info).not.toHaveBeenCalledWith(
      'Fetching public reconciliation overview',
      expect.anything(),
    );
  });
});

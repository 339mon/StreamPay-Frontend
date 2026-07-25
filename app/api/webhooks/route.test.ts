/**
 * Tests for GET|POST /api/webhooks rate limiting and metrics coexistence.
 */

import { GET, POST } from '@/app/api/webhooks/route';
import { registry } from '@/src/metrics/registry';
import { NextRequest } from 'next/server';
import {
  setRateLimitStore,
  resetRateLimitStore,
  type RateLimitStore,
  type RateLimitResult,
} from '@/app/lib/rate-limit-store';

jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  getCorrelationContext: jest.fn(() => ({ request_id: 'test-req-id' })),
}));

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

function makeGetRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks', {
    method: 'GET',
    headers: new Headers(headers),
  });
}

function makePostRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost/api/webhooks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  registry.resetMetrics();
  jest.clearAllMocks();
  setRateLimitStore(makeCountingStore({ remaining: 1_000 }));
});

afterEach(() => {
  resetRateLimitStore();
});

describe('GET /api/webhooks – rate limiting', () => {
  it('allows scrape when under the limit and returns prometheus metrics', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });

  it('returns 429 with Retry-After when the rate limit is exhausted', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 0, retryAfter: 42 }));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');

    const body = await res.json();
    expect(body.error.code).toBe('rate_limit_exceeded');
    expect(body.error.request_id).toBeDefined();
  });
});

describe('POST /api/webhooks – rate limiting', () => {
  it('allows request when under the limit', async () => {
    const res = await POST(makePostRequest({ eventType: 'grantfox.wave' }));
    expect(res.status).toBe(200);
  });

  it('returns 429 with standardised envelope when exhausted', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 0, retryAfter: 30 }));

    const res = await POST(makePostRequest({ eventType: 'grantfox.wave' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');

    const body = await res.json();
    expect(body).toMatchObject({
      error: {
        code: 'rate_limit_exceeded',
        message: expect.stringContaining('Rate limit'),
        request_id: expect.any(String),
      },
    });
  });

  it('does not process the body when rate-limited', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 0 }));

    // Malformed body would normally yield 400 — rate limit must win first.
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(429);
  });

  it('isolates buckets per identity', async () => {
    setRateLimitStore(makeCountingStore({ remaining: 1, perIdentity: true }));

    const a1 = await POST(
      makePostRequest({ eventType: 'a' }, { 'X-API-Key': 'key-alice' }),
    );
    const b1 = await POST(
      makePostRequest({ eventType: 'b' }, { 'X-API-Key': 'key-bob' }),
    );
    expect(a1.status).toBe(200);
    expect(b1.status).toBe(200);

    const a2 = await POST(
      makePostRequest({ eventType: 'a' }, { 'X-API-Key': 'key-alice' }),
    );
    const b2 = await POST(
      makePostRequest({ eventType: 'b' }, { 'X-API-Key': 'key-bob' }),
    );
    expect(a2.status).toBe(429);
    expect(b2.status).toBe(429);
  });

  it('still records metrics for allowed requests', async () => {
    const res = await POST(makePostRequest({ eventType: 'metric_check' }));
    expect(res.status).toBe(200);

    const metrics = await registry.metrics();
    expect(metrics).toContain(
      'webhook_requests_total{status="200",event_type="metric_check"} 1',
    );
  });
});

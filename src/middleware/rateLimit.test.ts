/**
 * src/middleware/rateLimit.test.ts
 *
 * Unit tests for the `applyRateLimit` middleware adapter.
 *
 * All external dependencies (rate-limit store, logger, metrics) are
 * either mocked or replaced with in-process stubs so these tests run
 * without I/O and are deterministic.
 */

import { applyRateLimit } from './rateLimit';
import {
  setRateLimitStore,
  resetRateLimitStore,
  type RateLimitStore,
  type RateLimitResult,
} from '@/app/lib/rate-limit-store';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  getCorrelationContext: jest.fn().mockReturnValue({
    request_id: 'unit-test-req',
    correlation_id: 'unit-test-corr',
  }),
}));

jest.mock('@/app/lib/rate-limit-metrics', () => ({
  recordThrottle: jest.fn(),
  recordRequest: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(opts: { url?: string; headers?: Record<string, string> } = {}): Request {
  return new Request(opts.url ?? 'http://localhost/api/reconciliation', {
    headers: new Headers(opts.headers ?? {}),
  });
}

function allowingStore(remaining = 59): RateLimitStore {
  return {
    async check(): Promise<RateLimitResult> {
      return { allowed: true, remaining, resetAt: Math.floor(Date.now() / 1000) + 60 };
    },
  };
}

function denyingStore(retryAfter = 30): RateLimitStore {
  return {
    async check(): Promise<RateLimitResult> {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + retryAfter,
        retryAfter,
      };
    },
  };
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  setRateLimitStore(allowingStore());
});

afterEach(() => {
  resetRateLimitStore();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('applyRateLimit', () => {
  describe('when the caller is within the limit', () => {
    it('returns null (allow-through)', async () => {
      const result = await applyRateLimit(makeRequest());
      expect(result).toBeNull();
    });

    it('returns null for an explicit limitType override', async () => {
      const result = await applyRateLimit(makeRequest(), 'reconciliation');
      expect(result).toBeNull();
    });

    it('calls recordRequest with the route path', async () => {
      const { recordRequest } = jest.requireMock('@/app/lib/rate-limit-metrics');
      await applyRateLimit(
        makeRequest({ url: 'http://localhost/api/reconciliation?limit=10' }),
      );
      expect(recordRequest).toHaveBeenCalledWith('/api/reconciliation');
    });

    it('does NOT call recordThrottle when allowed', async () => {
      const { recordThrottle } = jest.requireMock('@/app/lib/rate-limit-metrics');
      await applyRateLimit(makeRequest());
      expect(recordThrottle).not.toHaveBeenCalled();
    });
  });

  describe('when the rate limit is exhausted', () => {
    beforeEach(() => {
      setRateLimitStore(denyingStore(42));
    });

    it('returns a 429 NextResponse', async () => {
      const res = await applyRateLimit(makeRequest());
      expect(res).not.toBeNull();
      expect(res!.status).toBe(429);
    });

    it('response body is a standardised error envelope', async () => {
      const res = await applyRateLimit(makeRequest());
      const body = await res!.json();
      expect(body).toMatchObject({
        error: {
          code: 'rate_limit_exceeded',
          message: expect.any(String),
          request_id: expect.any(String),
        },
      });
    });

    it('Retry-After header reflects retryAfter value', async () => {
      const res = await applyRateLimit(makeRequest());
      expect(res!.headers.get('Retry-After')).toBe('42');
    });

    it('calls recordThrottle with correct metadata', async () => {
      const { recordThrottle } = jest.requireMock('@/app/lib/rate-limit-metrics');
      await applyRateLimit(
        makeRequest({ headers: { 'X-API-Key': 'some-key-123' } }),
        'reconciliation',
      );
      expect(recordThrottle).toHaveBeenCalledWith(
        '/api/reconciliation',
        'reconciliation',
        'api_key',
        expect.stringContaining('some-key'),
      );
    });

    it('emits a structured warn log', async () => {
      const { logger } = jest.requireMock('@/app/lib/logger');
      await applyRateLimit(makeRequest());
      expect(logger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          route: '/api/reconciliation',
          retryAfter: 42,
        }),
      );
    });
  });

  describe('identity resolution', () => {
    it('uses API key identity when X-API-Key header is present', async () => {
      const capturedKeys: string[] = [];
      setRateLimitStore({
        async check(identifier): Promise<RateLimitResult> {
          capturedKeys.push(identifier);
          return { allowed: true, remaining: 59, resetAt: 0 };
        },
      });

      await applyRateLimit(
        makeRequest({ headers: { 'X-API-Key': 'testkey-9999' } }),
      );

      // The store key is prefixed by limitType, e.g. "reconciliation:testkey-9999"
      expect(capturedKeys[0]).toContain('testkey-9999');
    });

    it('falls back to IP when no auth header is present', async () => {
      const capturedKeys: string[] = [];
      setRateLimitStore({
        async check(identifier): Promise<RateLimitResult> {
          capturedKeys.push(identifier);
          return { allowed: true, remaining: 59, resetAt: 0 };
        },
      });

      await applyRateLimit(
        makeRequest({ headers: { 'X-Forwarded-For': '203.0.113.5' } }),
      );

      expect(capturedKeys[0]).toContain('203.0.113.5');
    });
  });

  describe('limitType resolution', () => {
    it('uses provided limitType override', async () => {
      // Confirm "reconciliation" is forwarded to the store check key.
      const capturedKeys: string[] = [];
      setRateLimitStore({
        async check(identifier): Promise<RateLimitResult> {
          capturedKeys.push(identifier);
          return { allowed: true, remaining: 59, resetAt: 0 };
        },
      });

      await applyRateLimit(makeRequest(), 'reconciliation');

      // Key format is `${limitType}:${identityValue}`
      expect(capturedKeys[0]).toMatch(/^reconciliation:/);
    });

    it('falls back to getLimitForRoute when no override given', async () => {
      const capturedKeys: string[] = [];
      setRateLimitStore({
        async check(identifier): Promise<RateLimitResult> {
          capturedKeys.push(identifier);
          return { allowed: true, remaining: 59, resetAt: 0 };
        },
      });

      // GET /api/reconciliation is mapped to "reconciliation" in ROUTE_LIMITS
      await applyRateLimit(makeRequest());

      expect(capturedKeys[0]).toMatch(/^reconciliation:/);
    });
  });
});

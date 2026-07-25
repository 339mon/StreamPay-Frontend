import { GET } from './route';
import { getCorrelationContext } from '@/app/lib/logger';
import crypto from 'crypto';

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  getCorrelationContext: jest.fn(),
}));

describe('GET /api/reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCorrelationContext as jest.Mock).mockReturnValue({ request_id: 'test-req-id' });
  });

  it('returns 200 with strong ETag and valid data', async () => {
    const req = new Request('http://localhost:3000/api/reconciliation');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.data).toHaveLength(2);

    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it('validates limit parameter', async () => {
    const req = new Request('http://localhost:3000/api/reconciliation?limit=invalid');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('handles 304 Not Modified when ETag matches', async () => {
    // First request to get the ETag
    const req1 = new Request('http://localhost:3000/api/reconciliation');
    const res1 = await GET(req1);
    const etag = res1.headers.get('etag')!;

    // Second request with If-None-Match
    const req2 = new Request('http://localhost:3000/api/reconciliation', {
      headers: new Headers({ 'If-None-Match': etag }),
    });
    const res2 = await GET(req2);

    expect(res2.status).toBe(304);
    expect(res2.headers.get('etag')).toBe(etag);
  });
});

import { NextRequest } from 'next/server';
import { getChaosConfig, applyChaos } from './chaos';

describe('Chaos Injection Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default disabled config when env vars are absent', () => {
    const config = getChaosConfig();
    expect(config.enabled).toBe(false);
    expect(config.latencyMs).toBe(0);
    expect(config.errorRate).toBe(0);
  });

  it('should parse configuration from headers', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-chaos-enabled': 'true',
        'x-chaos-latency': '150',
        'x-chaos-error-rate': '1.0',
        'x-chaos-error-code': '503',
      },
    });

    const config = getChaosConfig(req);
    expect(config.enabled).toBe(true);
    expect(config.latencyMs).toBe(150);
    expect(config.errorRate).toBe(1.0);
    expect(config.errorCode).toBe(503);
  });

  it('should inject error response when errorRate is 1.0', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-chaos-enabled': 'true',
        'x-chaos-error-rate': '1.0',
        'x-chaos-error-code': '429',
      },
    });

    const res = await applyChaos(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    const body = await res?.json();
    expect(body.error.code).toBe(429);
    expect(body.error.message).toBe('Chaos injection triggered fault');
  });
});
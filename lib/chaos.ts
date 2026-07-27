import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface ChaosConfig {
  enabled: boolean;
  latencyMs: number;
  errorRate: number;
  errorCode: number;
}

export function getChaosConfig(req?: NextRequest): ChaosConfig {
  const enabled = process.env.CHAOS_ENABLED === 'true' || req?.headers.get('x-chaos-enabled') === 'true';
  const latencyMs = parseInt(process.env.CHAOS_LATENCY_MS || req?.headers.get('x-chaos-latency') || '0', 10);
  const errorRate = parseFloat(process.env.CHAOS_ERROR_RATE || req?.headers.get('x-chaos-error-rate') || '0');
  const errorCode = parseInt(process.env.CHAOS_ERROR_CODE || req?.headers.get('x-chaos-error-code') || '500', 10);

  return {
    enabled,
    latencyMs: isNaN(latencyMs) ? 0 : Math.max(0, latencyMs),
    errorRate: isNaN(errorRate) ? 0 : Math.min(1, Math.max(0, errorRate)),
    errorCode: isNaN(errorCode) ? 500 : errorCode,
  };
}

export async function applyChaos(req: NextRequest): Promise<NextResponse | null> {
  const config = getChaosConfig(req);
  if (!config.enabled) {
    return null;
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  if (config.latencyMs > 0) {
    console.warn(`[ChaosMW] [${correlationId}] Injecting latency of ${config.latencyMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, config.latencyMs));
  }

  if (config.errorRate > 0 && Math.random() < config.errorRate) {
    console.error(`[ChaosMW] [${correlationId}] Injecting failure with status ${config.errorCode}`);
    return NextResponse.json(
      {
        error: {
          code: config.errorCode,
          message: 'Chaos injection triggered fault',
          correlationId,
        },
      },
      { status: config.errorCode }
    );
  }

  return null;
}
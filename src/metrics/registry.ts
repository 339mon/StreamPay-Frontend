import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

// Optional: collect default nodejs metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: registry });

// ── /api/webhooks metrics ────────────────────────────────────────────────────

export const webhookCounter = new Counter({
  name: 'webhook_requests_total',
  help: 'Total number of webhook requests received',
  labelNames: ['status', 'event_type'],
  registers: [registry],
});

export const webhookDuration = new Histogram({
  name: 'webhook_request_duration_seconds',
  help: 'Histogram of webhook request processing duration in seconds',
  labelNames: ['status', 'event_type'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

/** Per-endpoint counter for `/api/streams` (GET/POST). */
export const streamsCounter = new Counter({
  name: 'streams_requests_total',
  help: 'Total number of /api/streams requests',
  labelNames: ['method', 'status'],
  registers: [registry],
});

/** Per-endpoint latency histogram for `/api/streams` (GET/POST). */
export const streamsDuration = new Histogram({
  name: 'streams_request_duration_seconds',
  help: 'Histogram of /api/streams request processing duration in seconds',
  labelNames: ['method', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

/**
 * Record a completed `/api/streams` request on the shared Prometheus registry.
 */
export function observeStreamsRequest(
  method: string,
  status: number,
  start: [number, number],
): void {
  const diff = process.hrtime(start);
  const durationSeconds = diff[0] + diff[1] / 1e9;
  const labels = { method: method.toUpperCase(), status: String(status) };
  streamsCounter.inc(labels);
  streamsDuration.observe(labels, durationSeconds);
}

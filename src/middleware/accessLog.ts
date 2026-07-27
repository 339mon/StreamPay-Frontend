import { getCorrelationContext, logger } from "@/app/lib/logger";

export interface AccessLogContext {
  method: string;
  path: string;
  status: number;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export function logAccessEvent(context: AccessLogContext): void {
  const correlation = getCorrelationContext();

  logger.info("http access", {
    ...context,
    request_id: correlation?.request_id,
    correlation_id: correlation?.correlation_id,
    traceparent: correlation?.traceparent,
  });
}

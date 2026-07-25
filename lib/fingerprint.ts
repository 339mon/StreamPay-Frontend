import { createHash } from 'node:crypto';
import { logger } from '../app/lib/logger';

/**
 * Normalizes the client IP address from request headers.
 * Following specification: x-forwarded-for (first hop), x-real-ip,
 * cf-connecting-ip, true-client-ip.
 *
 * @param headers - Request headers
 * @returns Normalized IP string, or "unknown"
 */
function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // The first IP in the list is the client IP
    return forwardedFor.split(',')[0].trim().toLowerCase();
  }
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim().toLowerCase();
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim().toLowerCase();
  const trueClientIp = headers.get('true-client-ip');
  if (trueClientIp) return trueClientIp.trim().toLowerCase();

  return 'unknown';
}

export const REQUEST_FINGERPRINT_HEADER = 'x-request-fingerprint';

/**
 * Normalizes request signals to generate a stable, non-volatile fingerprint.
 *
 * @param request - The incoming request
 * @returns SHA-256 hash string
 */
export function generateFingerprint(request: Request): string {
  try {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    // Normalize path: trailing slashes removed
    let pathname = url.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    pathname = pathname.toLowerCase();

    const clientIp = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent')?.trim().toLowerCase() || '';
    const acceptLanguage = request.headers.get('accept-language')?.split(',')[0].trim().toLowerCase() || '';
    const acceptEncoding = request.headers.get('accept-encoding')
      ?.split(',')
      .map((s) => s.trim().toLowerCase())
      .sort()
      .join(',') || '';

    const fingerprintString = [
      method,
      pathname,
      clientIp,
      userAgent,
      acceptLanguage,
      acceptEncoding,
    ].join('|');

    return createHash('sha256').update(fingerprintString).digest('hex');
  } catch (error) {
    logger.warn('Failed to compute request fingerprint', { error });
    return 'fingerprint-error';
  }
}

/**
 * Captures and returns the request fingerprint.
 *
 * @param request - The incoming request
 * @returns SHA-256 hash string
 */
export async function captureRequestFingerprint(request: Request): Promise<string> {
  return generateFingerprint(request);
}

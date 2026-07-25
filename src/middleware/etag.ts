import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Applies a strong ETag to a JSON response payload and handles the 
 * If-None-Match conditional request flow.
 * 
 * A strong validator ensures byte-for-byte identity of the resource representation.
 */
export function withStrongEtag(
  request: Request,
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): NextResponse {
  const body = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const etag = `"${hash}"`;

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) {
    const clientEtags = ifNoneMatch.split(',').map((t) => t.trim());
    if (clientEtags.includes(etag) || clientEtags.includes('*')) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...extraHeaders,
          etag,
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      });
    }
  }

  return new NextResponse(body, {
    status,
    headers: {
      ...extraHeaders,
      'content-type': 'application/json',
      etag,
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}

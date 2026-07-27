import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyChaos } from '@/lib/chaos';

export async function middleware(req: NextRequest) {
  const chaosResponse = await applyChaos(req);
  if (chaosResponse) {
    return chaosResponse;
  }

  const response = NextResponse.next();
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  response.headers.set('x-correlation-id', correlationId);

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
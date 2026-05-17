import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/jwt';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('ezeem_token')?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      // Clone headers and set identity headers from verified token
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', String(payload.userId));
      requestHeaders.set('x-user-role', String(payload.role));
      requestHeaders.set('x-user-name', String(payload.name));

      // Return response with modified headers
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  return NextResponse.next();
}

// Only run middleware on API routes
export const config = {
  matcher: '/api/:path*',
};

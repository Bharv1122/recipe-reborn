import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_ROUTES = [
  '/generator',
  '/recipes',
  '/collections',
  '/meal-planner',
  '/shopping-lists',
  '/account',
];

// Hands-free kitchen mode (/kitchen/...) offers optional voice commands, so it
// alone may ask for the microphone (same-origin only). Every other page keeps
// the microphone blocked exactly as before.
function permissionsPolicy(pathname: string) {
  const mic = pathname === '/kitchen' || pathname.startsWith('/kitchen/') ? 'microphone=(self)' : 'microphone=()';
  return `camera=(), ${mic}, geolocation=()`;
}

function withSecurityHeaders(response: NextResponse, pathname = '') {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', permissionsPolicy(pathname));
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set(
        'callbackUrl',
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return withSecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

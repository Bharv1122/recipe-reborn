import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logServerError } from '@/lib/server-error-log';

export const dynamic = 'force-dynamic';

const clientErrorSchema = z.object({
  boundary: z.enum(['route', 'global']),
  digest: z.string().trim().max(128).optional(),
  errorName: z.string().trim().max(80).optional(),
  pathname: z.string().trim().max(200),
});

let windowStartedAt = Date.now();
let reportsInWindow = 0;

function canAcceptReport() {
  const now = Date.now();
  if (now - windowStartedAt >= 60_000) {
    windowStartedAt = now;
    reportsInWindow = 0;
  }
  reportsInWindow += 1;
  return reportsInWindow <= 60;
}

function sanitizePathname(pathname: string) {
  const safePath = pathname.split('?')[0].split('#')[0];
  if (/^\/share\/[^/]+/.test(safePath)) return '/share/[redacted]';
  if (/^\/cooking-mode\/[^/]+/.test(safePath)) return '/cooking-mode/[redacted]';
  return safePath.startsWith('/') ? safePath : '/unknown';
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2_048) {
    return NextResponse.json({ accepted: false }, { status: 413 });
  }

  if (!canAcceptReport()) {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = clientErrorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }

  logServerError('client_page_failure', undefined, {
    boundary: parsed.data.boundary,
    digest: parsed.data.digest,
    errorName: parsed.data.errorName,
    pathname: sanitizePathname(parsed.data.pathname),
  });

  return new NextResponse(null, { status: 204 });
}

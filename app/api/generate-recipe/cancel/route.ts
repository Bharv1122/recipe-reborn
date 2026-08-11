import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { markGenerationCanceled } from '@/lib/generation-cancellation';
import { logServerError } from '@/lib/server-error-log';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({ generationId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cancellation request' }, { status: 400 });
  }

  try {
    await markGenerationCanceled(session.user.id, parsed.data.generationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logServerError('generation_cancel_marker_failed', error);
    return NextResponse.json({ error: 'Unable to cancel generation' }, { status: 500 });
  }
}

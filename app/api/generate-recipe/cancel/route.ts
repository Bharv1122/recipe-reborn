import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { markGenerationCanceled } from '@/lib/generation-cancellation';
import { logServerError } from '@/lib/server-error-log';
import { getRequestUserId } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({ generationId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cancellation request' }, { status: 400 });
  }

  try {
    await markGenerationCanceled(userId, parsed.data.generationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logServerError('generation_cancel_marker_failed', error);
    return NextResponse.json({ error: 'Unable to cancel generation' }, { status: 500 });
  }
}

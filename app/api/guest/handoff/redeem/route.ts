import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  GuestRecipeHandoffError,
  redeemGuestRecipeHandoff,
} from '@/lib/guest-recipe-handoff';

export const dynamic = 'force-dynamic';

const STATUS_BY_CODE = {
  invalid: 400,
  expired: 410,
  replayed: 409,
  quota: 403,
  account: 404,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Please sign in to unlock this recipe preview.' }, { status: 401 });
    }

    const limited = await rateLimit(`guest-handoff:${userId}`, 10, 60);
    if (!limited.success) {
      return NextResponse.json(
        { error: 'Too many unlock attempts. Please wait a minute and try again.' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    const result = await redeemGuestRecipeHandoff({ token, userId });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof GuestRecipeHandoffError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: STATUS_BY_CODE[error.code] },
      );
    }
    console.error('Guest recipe handoff redemption failed:', error);
    return NextResponse.json(
      { error: 'We could not unlock that preview right now. Reload to try again; your ingredients are still ready.' },
      { status: 500 },
    );
  }
}

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { revokeMobileRefreshToken } from '@/lib/mobile-auth';

export async function POST(request: Request) {
  const parsed = z.object({ refreshToken: z.string().min(1).max(300) })
    .safeParse(await request.json().catch(() => null));
  if (parsed.success) await revokeMobileRefreshToken(parsed.data.refreshToken);
  return NextResponse.json({ success: true });
}

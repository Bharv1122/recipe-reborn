import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

const tokenSchema = z.object({
  token: z.string().trim().regex(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/).max(220),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().trim().max(120).optional(),
});

export async function PUT(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid push token.' }, { status: 400 });
    const existing = await prisma.mobilePushToken.findUnique({ where: { token: parsed.data.token }, select: { userId: true } });
    if (existing && existing.userId !== userId) {
      return NextResponse.json({ error: 'That device token is already registered.' }, { status: 409 });
    }
    const registered = await prisma.mobilePushToken.upsert({
      where: { token: parsed.data.token },
      create: { userId, ...parsed.data, deviceName: parsed.data.deviceName || null },
      update: { platform: parsed.data.platform, deviceName: parsed.data.deviceName || null },
      select: { id: true, platform: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ registered });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to register notifications.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ token: z.string().trim().min(1).max(220) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid push token.' }, { status: 400 });
    await prisma.mobilePushToken.deleteMany({ where: { token: parsed.data.token, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to unregister notifications.' }, { status: 500 });
  }
}

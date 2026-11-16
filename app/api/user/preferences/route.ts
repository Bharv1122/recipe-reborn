import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

// Sanitize a user-supplied ingredient list: trim, drop empties, cap sizes
function cleanList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 60);
  // De-duplicate case-insensitively, keep first casing the user typed
  const seen = new Set<string>();
  const unique = cleaned.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, 50);
}

// GET /api/user/preferences - fetch saved food preferences
export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { allergies: true, dislikedIngredients: true, likedIngredients: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PUT /api/user/preferences - update food preferences
export async function PUT(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid food preferences.' }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  const supplied = ['allergies', 'dislikedIngredients', 'likedIngredients'].filter((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (!supplied.length) {
    return NextResponse.json(
      { error: 'Provide at least one food preference field.' },
      { status: 400 }
    );
  }
  const cleaned = Object.fromEntries(supplied.map((key) => [key, cleanList(value[key])]));
  if (Object.values(cleaned).some((list) => list === null)) {
    return NextResponse.json({ error: 'Food preference fields must be arrays of short ingredient names.' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: cleaned as { allergies?: string[]; dislikedIngredients?: string[]; likedIngredients?: string[] },
    select: { allergies: true, dislikedIngredients: true, likedIngredients: true },
  });

  return NextResponse.json(user);
}

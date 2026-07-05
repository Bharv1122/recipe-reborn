import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

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
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { allergies: true, dislikedIngredients: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PUT /api/user/preferences - update food preferences
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const allergies = cleanList(body.allergies);
  const dislikedIngredients = cleanList(body.dislikedIngredients);

  if (allergies === null && dislikedIngredients === null) {
    return NextResponse.json(
      { error: 'Provide allergies and/or dislikedIngredients as arrays of strings' },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(allergies !== null && { allergies }),
      ...(dislikedIngredients !== null && { dislikedIngredients }),
    },
    select: { allergies: true, dislikedIngredients: true },
  });

  return NextResponse.json(user);
}

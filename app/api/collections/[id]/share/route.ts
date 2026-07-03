import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// POST /api/collections/[id]/share - Toggle collection sharing
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Toggle isPublic and manage shareToken
    const newIsPublic = !collection.isPublic;
    const shareToken = newIsPublic && !collection.shareToken
      ? crypto.randomBytes(16).toString('hex')
      : collection.shareToken;

    const updatedCollection = await prisma.collection.update({
      where: { id: params.id },
      data: {
        isPublic: newIsPublic,
        shareToken: newIsPublic ? shareToken : null,
      },
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const shareUrl = newIsPublic && shareToken
      ? `${origin}/share/collection/${shareToken}`
      : null;

    return NextResponse.json({
      ...updatedCollection,
      shareUrl,
    });
  } catch (error) {
    console.error('Error toggling collection sharing:', error);
    return NextResponse.json(
      { error: 'Failed to toggle collection sharing' },
      { status: 500 }
    );
  }
}

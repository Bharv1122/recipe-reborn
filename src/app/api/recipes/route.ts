import { NextResponse } from 'next/server';
import { getAuthCookie, verifyToken } from '@/lib/auth';
import { getRecipesByUserId } from '@/lib/db';

export async function GET() {
  try {
    // Check authentication
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user's recipes only
    const recipes = await getRecipesByUserId(payload.userId);

    return NextResponse.json({
      success: true,
      recipes,
    });
  } catch (error) {
    console.error('Get recipes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

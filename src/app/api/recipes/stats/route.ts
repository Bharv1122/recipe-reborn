import { NextResponse } from 'next/server';
import { getAuthCookie, verifyToken } from '@/lib/auth';
import { getUserRecipeStats, getRecipesByUserId } from '@/lib/db';

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

    // Get user stats
    const stats = await getUserRecipeStats(payload.userId);
    
    // Get recent recipes for activity
    const recipes = await getRecipesByUserId(payload.userId);
    const recentRecipes = recipes.slice(0, 3);

    return NextResponse.json({
      success: true,
      stats,
      recentRecipes,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

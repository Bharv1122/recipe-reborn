import { NextResponse } from 'next/server';
import { getAuthCookie, verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const token = await getAuthCookie();
    
    if (!token) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

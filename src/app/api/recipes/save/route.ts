import { NextResponse } from 'next/server';
import { getAuthCookie, verifyToken } from '@/lib/auth';
import { createRecipe } from '@/lib/db';

export async function POST(request: Request) {
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

    // Parse recipe data
    const body = await request.json();
    const { title, description, ingredients, instructions, cookTime, servings, nutritionInfo, tags } = body;

    // Validate required fields
    if (!title || !ingredients || !instructions) {
      return NextResponse.json(
        { error: 'Missing required fields: title, ingredients, and instructions are required' },
        { status: 400 }
      );
    }

    // Create recipe
    const recipe = await createRecipe(payload.userId, {
      title,
      description: description || '',
      ingredients: ingredients || [],
      instructions: instructions || [],
      cookTime: cookTime || 'N/A',
      servings: servings || 4,
      nutritionInfo: nutritionInfo || {
        calories: 'N/A',
        protein: 'N/A',
        carbs: 'N/A',
        fat: 'N/A',
      },
      tags: tags || [],
    });

    return NextResponse.json({
      success: true,
      recipe,
    });
  } catch (error) {
    console.error('Save recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe' },
      { status: 500 }
    );
  }
}

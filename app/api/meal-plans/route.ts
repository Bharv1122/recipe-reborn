import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/meal-plans - Get all meal plans for the user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mealPlans = await prisma.mealPlan.findMany({
      where: { userId: session.user.id },
      include: {
        mealPlanRecipes: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                prepTime: true,
                cookTime: true,
                servings: true,
                dietaryTags: true,
                calories: true,
                protein: true,
                carbs: true,
                fat: true,
              },
            },
          },
          orderBy: [
            { day: 'asc' },
            { order: 'asc' },
          ],
        },
      },
      orderBy: { weekStartDate: 'desc' },
    });

    return NextResponse.json(mealPlans);
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meal plans' },
      { status: 500 }
    );
  }
}

// POST /api/meal-plans - Create a new meal plan
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, weekStartDate, description } = await req.json();

    if (!name || !weekStartDate) {
      return NextResponse.json(
        { error: 'Name and week start date are required' },
        { status: 400 }
      );
    }

    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId: session.user.id,
        name,
        weekStartDate: new Date(weekStartDate),
        description,
      },
      include: {
        mealPlanRecipes: {
          include: {
            recipe: true,
          },
        },
      },
    });

    return NextResponse.json(mealPlan, { status: 201 });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to create meal plan' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        generationCount: true,
        lastGenerationReset: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Lifetime cost savings across saved recipes: per-serving savings x servings per recipe
    const recipesWithCosts = await prisma.recipe.findMany({
      where: {
        userId: session.user.id,
        estimatedCostPerServing: { not: null },
        storeBoughtCost: { not: null },
      },
      select: {
        estimatedCostPerServing: true,
        storeBoughtCost: true,
        servings: true,
      },
    });

    const lifetimeSavings = recipesWithCosts.reduce((total, recipe) => {
      const perServing = (recipe.storeBoughtCost ?? 0) - (recipe.estimatedCostPerServing ?? 0);
      if (perServing <= 0) return total;
      const servings = parseInt(recipe.servings ?? '', 10);
      return total + perServing * (Number.isFinite(servings) && servings > 0 ? servings : 1);
    }, 0);

    return NextResponse.json({ ...user, lifetimeSavings });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription data' },
      { status: 500 }
    );
  }
}

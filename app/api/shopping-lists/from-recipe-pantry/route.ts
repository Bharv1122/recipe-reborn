import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  categorizeIngredient,
  comparePantryToRecipe,
  parseIngredientLine,
  parseStoredIngredients,
} from '@/lib/pantry-match';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  recipeId: z.string().min(1),
  pantryItems: z.string().trim().min(1).max(5000),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: 'A saved recipe and pantry items are required' },
        { status: 400 },
      );
    }

    const { recipeId, pantryItems, name } = parsedRequest.data;
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, userId: session.user.id },
      select: { id: true, title: true, freshIngredients: true },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const comparison = comparePantryToRecipe(
      parseStoredIngredients(recipe.freshIngredients),
      pantryItems,
    );

    if (comparison.missing.length === 0) {
      return NextResponse.json({
        shoppingList: null,
        ...comparison,
        message: 'You already have every ingredient for this recipe.',
      });
    }

    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId: session.user.id,
        name: name || `${recipe.title} - Missing Ingredients`,
        notes: `Pantry-checked list for ${recipe.title}. Includes only ingredients not marked as on hand.`,
        items: {
          create: comparison.missing.map((ingredientLine, order) => {
            const parsed = parseIngredientLine(ingredientLine);
            return {
              ingredient: parsed.ingredient,
              quantity: parsed.quantity,
              unit: parsed.unit,
              category: categorizeIngredient(parsed.ingredient),
              recipeId: recipe.id,
              recipeTitle: recipe.title,
              order,
            };
          }),
        },
      },
      include: {
        items: {
          orderBy: [{ category: 'asc' }, { order: 'asc' }],
        },
      },
    });

    return NextResponse.json(
      { shoppingList, ...comparison },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create pantry-checked shopping list error:', error);
    return NextResponse.json(
      { error: 'Failed to create a pantry-checked shopping list' },
      { status: 500 },
    );
  }
}

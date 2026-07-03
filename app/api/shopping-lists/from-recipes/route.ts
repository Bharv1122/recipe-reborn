import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Category mapping for common ingredients
const CATEGORY_MAP: Record<string, string> = {
  // Produce
  tomato: 'Produce',
  onion: 'Produce',
  garlic: 'Produce',
  potato: 'Produce',
  carrot: 'Produce',
  lettuce: 'Produce',
  spinach: 'Produce',
  apple: 'Produce',
  banana: 'Produce',
  lemon: 'Produce',
  lime: 'Produce',
  pepper: 'Produce',
  broccoli: 'Produce',
  mushroom: 'Produce',
  avocado: 'Produce',
  
  // Dairy
  milk: 'Dairy',
  cheese: 'Dairy',
  butter: 'Dairy',
  cream: 'Dairy',
  yogurt: 'Dairy',
  egg: 'Dairy',
  
  // Meat & Seafood
  chicken: 'Meat & Seafood',
  beef: 'Meat & Seafood',
  pork: 'Meat & Seafood',
  fish: 'Meat & Seafood',
  salmon: 'Meat & Seafood',
  shrimp: 'Meat & Seafood',
  turkey: 'Meat & Seafood',
  
  // Pantry
  flour: 'Pantry',
  sugar: 'Pantry',
  salt: 'Pantry',
  oil: 'Pantry',
  rice: 'Pantry',
  pasta: 'Pantry',
  bread: 'Pantry',
  sauce: 'Pantry',
  spice: 'Pantry',
  herb: 'Pantry',
  vinegar: 'Pantry',
};

function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) {
      return category;
    }
  }
  
  return 'Other';
}

function parseIngredient(ingredientLine: string) {
  // Simple parsing - extract quantity, unit, and ingredient
  // Examples: "2 cups flour", "1 lb chicken", "3 large eggs"
  const match = ingredientLine.match(/^([\d\/\-\.\s]+)?\s*([a-zA-Z]+)?\s*(.+)$/);
  
  if (match) {
    const quantity = match[1]?.trim() || '';
    const unit = match[2]?.trim() || '';
    const ingredient = match[3]?.trim() || ingredientLine;
    
    return {
      quantity: quantity || undefined,
      unit: unit || undefined,
      ingredient: ingredient.replace(/^(of|fresh|dried|chopped|minced|diced)\s+/i, ''),
    };
  }
  
  return {
    quantity: undefined,
    unit: undefined,
    ingredient: ingredientLine,
  };
}

// POST /api/shopping-lists/from-recipes - Generate shopping list from recipes
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipeIds, name } = await req.json();

    if (!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) {
      return NextResponse.json(
        { error: 'Recipe IDs are required' },
        { status: 400 }
      );
    }

    // Fetch all recipes
    const recipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        userId: session.user.id,
      },
    });

    if (recipes.length === 0) {
      return NextResponse.json(
        { error: 'No recipes found' },
        { status: 404 }
      );
    }

    // Create shopping list
    const listName = name || `Shopping List - ${new Date().toLocaleDateString()}`;
    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId: session.user.id,
        name: listName,
        notes: `Generated from ${recipes.length} recipe(s)`,
      },
    });

    // Aggregate ingredients from all recipes
    const ingredientMap = new Map<string, {
      quantity?: string;
      unit?: string;
      ingredient: string;
      recipeIds: string[];
      recipeTitles: string[];
      category: string;
    }>();

    for (const recipe of recipes) {
      const ingredients = recipe.freshIngredients.split('\n');
      
      for (const ingredientLine of ingredients) {
        if (!ingredientLine.trim()) continue;
        
        const parsed = parseIngredient(ingredientLine);
        const key = parsed.ingredient.toLowerCase().trim();
        
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          existing.recipeIds.push(recipe.id);
          existing.recipeTitles.push(recipe.title);
          
          // Simple quantity aggregation (for now, just concatenate)
          if (parsed.quantity && existing.quantity) {
            existing.quantity = `${existing.quantity} + ${parsed.quantity}`;
          } else if (parsed.quantity) {
            existing.quantity = parsed.quantity;
          }
        } else {
          const category = categorizeIngredient(parsed.ingredient);
          ingredientMap.set(key, {
            ...parsed,
            recipeIds: [recipe.id],
            recipeTitles: [recipe.title],
            category,
          });
        }
      }
    }

    // Create shopping list items
    const items = [];
    let order = 0;
    
    for (const [_, data] of ingredientMap) {
      const item = await prisma.shoppingListItem.create({
        data: {
          shoppingListId: shoppingList.id,
          ingredient: data.ingredient,
          quantity: data.quantity,
          unit: data.unit,
          category: data.category,
          recipeId: data.recipeIds[0], // Store first recipe ID
          recipeTitle: data.recipeTitles.join(', '),
          order: order++,
        },
      });
      items.push(item);
    }

    // Fetch complete shopping list with items
    const completeList = await prisma.shoppingList.findUnique({
      where: { id: shoppingList.id },
      include: {
        items: {
          orderBy: [
            { category: 'asc' },
            { order: 'asc' },
          ],
        },
      },
    });

    return NextResponse.json(completeList, { status: 201 });
  } catch (error) {
    console.error('Error generating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to generate shopping list' },
      { status: 500 }
    );
  }
}
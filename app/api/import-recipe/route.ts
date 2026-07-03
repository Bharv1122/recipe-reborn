import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// Tier limits
const TIER_LIMITS = {
  free: 10,
  premium: 100,
  pro: Infinity,
};

// POST /api/import-recipe - Import recipe from URL
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Valid URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Get user with subscription info and check limits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        generationCount: true,
        lastGenerationReset: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if we need to reset monthly counter
    const now = new Date();
    const lastReset = new Date(user.lastGenerationReset);
    const daysSinceReset = Math.floor(
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceReset >= 30) {
      // Reset counter after 30 days
      await prisma.user.update({
        where: { id: user.id },
        data: {
          generationCount: 0,
          lastGenerationReset: now,
        },
      });
      user.generationCount = 0;
    }

    // Check subscription limits
    const limit = TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    if (user.generationCount >= limit) {
      return NextResponse.json(
        {
          error: 'Generation limit reached',
          limit,
          current: user.generationCount,
          tier: user.subscriptionTier,
          message:
            user.subscriptionTier === 'free'
              ? 'You have reached your free tier limit of 10 recipes per month. Upgrade to Premium for 100 recipes or Pro for unlimited recipes.'
              : `You have reached your ${user.subscriptionTier} tier limit of ${limit} recipes this month.`,
        },
        { status: 403 }
      );
    }

    // Increment generation count
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationCount: { increment: 1 },
      },
    });

    const apiKey = AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch the recipe page
    let htmlContent;
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!pageResponse.ok) {
        throw new Error('Failed to fetch recipe page');
      }
      
      htmlContent = await pageResponse.text();
    } catch (fetchError) {
      console.error('Error fetching recipe page:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch recipe from URL. The website may be blocking requests.' },
        { status: 500 }
      );
    }

    // Use AI to extract recipe information from HTML
    const prompt = `Extract recipe information from this HTML content and return it in JSON format.

HTML Content (first 10000 chars):
${htmlContent.substring(0, 10000)}

Please extract and return in this exact JSON format:
{
  "title": "Recipe title",
  "ingredients": "Comma-separated list of ingredients with quantities",
  "instructions": "Step-by-step cooking instructions",
  "prepTime": "Prep time (e.g., 15 minutes)",
  "cookTime": "Cook time (e.g., 30 minutes)",
  "servings": "Number of servings (e.g., 4 servings)",
  "dietaryTags": ["Array of dietary tags like Vegan, Gluten-Free, etc."]
}

If you cannot find specific information, use reasonable defaults. Return ONLY valid JSON, no markdown.`;

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [
          {
            role: 'system',
            content: 'You are a recipe extraction assistant. Extract recipe information from HTML and return it in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse recipe');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse the JSON response
    let recipeData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      recipeData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse recipe JSON:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse recipe data. The page format may not be supported.' },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      return NextResponse.json(
        { error: 'Could not extract complete recipe information from the URL' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      recipe: {
        title: recipeData.title,
        originalIngredients: recipeData.ingredients,
        freshIngredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        prepTime: recipeData.prepTime || 'Not specified',
        cookTime: recipeData.cookTime || 'Not specified',
        servings: recipeData.servings || 'Not specified',
        dietaryTags: recipeData.dietaryTags || [],
      }
    });
  } catch (error) {
    console.error('Error importing recipe:', error);
    return NextResponse.json(
      { error: 'Failed to import recipe from URL' },
      { status: 500 }
    );
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ingredients, dietaryRestriction, isSubstitutionRegeneration, originalRecipe, substitution } = body;

    if (!ingredients) {
      return NextResponse.json(
        { error: 'Ingredients are required' },
        { status: 400 }
      );
    }

    // Get user with subscription info
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

    // Construct the prompt based on the type of request
    let prompt = '';
    if (isSubstitutionRegeneration && originalRecipe && substitution) {
      // Handle ingredient substitution regeneration
      prompt = `You are a professional chef. A user wants to substitute an ingredient in their recipe and needs the ENTIRE recipe regenerated to work with the substitute.

ORIGINAL RECIPE:
Title: ${originalRecipe.title}

Original Ingredients:
${originalRecipe.ingredients.map((ing: string, i: number) => `${i + 1}. ${ing}`).join('\n')}

Original Instructions:
${originalRecipe.instructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}

SUBSTITUTION REQUEST:
Replace: "${substitution.original}"
With: "${substitution.substitute}"

Please regenerate the ENTIRE recipe, adapting:
1. Update the ingredient list to include the substitute with proper quantities
2. Adjust ALL instructions that mention the original ingredient
3. Modify cooking times if the substitute requires different preparation
4. Update the recipe title if appropriate to reflect the substitution
5. Ensure the recipe remains cohesive and delicious with the new ingredient

Provide a JSON response with this exact structure:
{
  "title": "Recipe name (updated if needed)",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4"
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else if (dietaryRestriction) {
      prompt = `Transform the following recipe to be ${dietaryRestriction} compliant. Ensure ALL ingredients and instructions align with ${dietaryRestriction} dietary restrictions.

Original processed ingredients: ${ingredients}

Provide a JSON response with this exact structure:
{
  "title": "Recipe name",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4"
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else {
      prompt = `You are a professional chef helping users create fresh, healthy recipes from processed food ingredients.

The user has these processed food ingredients: ${ingredients}

Create a fresh, healthy recipe using whole, unprocessed ingredients that captures the essence of these processed foods. Provide clear, step-by-step instructions.

Provide a JSON response with this exact structure:
{
  "title": "Recipe name",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4"
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    }

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: messages,
        stream: true,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response?.ok) {
      throw new Error('LLM API request failed');
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let partialRead = '';

        try {
          while (true) {
            const result = await reader?.read();
            if (result?.done) break;

            partialRead += decoder.decode(result?.value, { stream: true });
            let lines = partialRead?.split('\n') ?? [];
            partialRead = lines?.pop() ?? '';

            for (const line of lines) {
              if (line?.startsWith('data: ')) {
                const data = line?.slice(6);
                if (data === '[DONE]') {
                  try {
                    const finalResult = JSON.parse(buffer);
                    const finalData = JSON.stringify({
                      status: 'completed',
                      result: finalResult,
                    });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  } catch (e) {
                    console.error('Error parsing final JSON:', e);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ status: 'error', message: 'Failed to parse recipe' })}\n\n`
                      )
                    );
                  }
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed?.choices?.[0]?.delta?.content ?? '';
                  const progressData = JSON.stringify({
                    status: 'processing',
                    message: 'Generating recipe...',
                  });
                  controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: 'error', message: 'Stream failed' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generate recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
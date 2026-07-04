import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface RecipeContext {
  title?: string;
  ingredients?: string[];
  instructions?: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  dietaryTags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { messages, recipe } = (await request.json()) as {
      messages?: Array<{ role: string; content: string }>;
      recipe?: RecipeContext;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const ingredients = recipe?.ingredients?.length
      ? recipe.ingredients.map((item) => `- ${item}`).join('\n')
      : 'Not provided';
    const instructions = recipe?.instructions?.length
      ? recipe.instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')
      : 'Not provided';

    const systemMessage = {
      role: 'system',
      content: `You are RecipeReborn AI, a friendly cooking assistant. The user is asking questions about this specific recipe:

Title: ${recipe?.title ?? 'Untitled recipe'}
${recipe?.prepTime ? `Prep time: ${recipe.prepTime}` : ''}
${recipe?.cookTime ? `Cook time: ${recipe.cookTime}` : ''}
${recipe?.servings ? `Servings: ${recipe.servings}` : ''}
${recipe?.dietaryTags?.length ? `Dietary tags: ${recipe.dietaryTags.join(', ')}` : ''}

Ingredients:
${ingredients}

Instructions:
${instructions}

Your role:
- Answer questions about this recipe: techniques, timing, substitutions, scaling, storage, make-ahead tips, and equipment
- Ground every answer in the recipe above; refer to steps and ingredients by name
- Keep responses concise (2-4 sentences) and practical for someone actively cooking
- If asked something unrelated to cooking, gently steer back to the recipe

Be warm, encouraging, and enthusiastic about healthy cooking!`,
    };

    const apiMessages = [systemMessage, ...messages];

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: apiMessages,
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response?.ok) {
      const errorText = await response?.text();
      console.error('LLM API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to process recipe chat request' },
        { status: response?.status ?? 500 }
      );
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
            if (done) break;

            const chunk = decoder.decode(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Recipe chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

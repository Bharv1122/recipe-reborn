import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, BackupTransportError, ProviderConnectionError } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';

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

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

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

    // The deadline covers the whole stream. Provider fallback can only happen
    // before the first byte, so a client never receives two partial answers.
    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: apiMessages,
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      }),
    }, { totalMs: 45_000 });

    if (!response.ok || !response.body) {
      // Never log provider bodies; they can echo the conversation.
      console.error('LLM API error:', response.status);
      await response.body?.cancel();
      return NextResponse.json(
        { error: 'Failed to process recipe chat request' },
        { status: response.ok ? 502 : response.status }
      );
    }

    // Pass provider bytes through untouched; cancelling this body aborts the provider.
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Recipe chat took too long. Please try again.' }, { status: 504 });
    }
    if (error instanceof BackupTransportError || error instanceof ProviderConnectionError) {
      return NextResponse.json({ error: 'Recipe chat is temporarily unavailable. Please try again.' }, { status: 503 });
    }
    console.error('Recipe chat error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

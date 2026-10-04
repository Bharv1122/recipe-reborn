import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, BackupTransportError, ProviderConnectionError } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';

export const dynamic = 'force-dynamic';

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

    const { messages, mode } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Prepare system message based on mode
    const systemMessage = mode === 'conversational'
      ? {
          role: 'system',
          content: `You are RecipeReborn AI, a friendly cooking assistant that helps transform processed food ingredients into fresh, healthy recipes. 

Your role:
- Help users discover fresh alternatives to processed foods
- Suggest recipes based on ingredients they mention
- Provide cooking tips and ingredient substitutions
- Keep responses concise (2-3 sentences) for natural conversation
- If they mention processed food items, suggest fresh ingredient alternatives
- Ask clarifying questions when needed (dietary restrictions, servings, etc.)

Be warm, encouraging, and enthusiastic about healthy cooking!`
        }
      : {
          role: 'system',
          content: `You are a voice transcription assistant for RecipeReborn. The user has spoken their ingredients or recipe requirements. Extract and format the information clearly. If they mentioned processed food ingredients, list them. If they gave recipe requirements, summarize them. Keep your response brief and formatted as a bulleted list.`
        };

    const apiMessages = [
      systemMessage,
      ...messages
    ];

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
        { error: 'Failed to process voice chat request' },
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
      return NextResponse.json({ error: 'Voice chat took too long. Please try again.' }, { status: 504 });
    }
    if (error instanceof BackupTransportError || error instanceof ProviderConnectionError) {
      return NextResponse.json({ error: 'Voice chat is temporarily unavailable. Please try again.' }, { status: 503 });
    }
    console.error('Voice chat error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

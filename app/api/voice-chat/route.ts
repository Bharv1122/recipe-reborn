import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';

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
        { error: 'Failed to process voice chat request' },
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
    console.error('Voice chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

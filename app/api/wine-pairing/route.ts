import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, hasRecipeAIKey } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { ENTITLEMENT_SELECT, hasPremiumAccess, premiumRequiredMessage } from '@/lib/entitlement';
import { prisma } from '@/lib/db';
import { limitAiRequest } from '@/lib/ai-rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/wine-pairing - Get AI-powered wine pairing recommendations
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: ENTITLEMENT_SELECT });
    if (!hasPremiumAccess(user)) {
      return NextResponse.json(
        { error: 'Premium feature', message: premiumRequiredMessage(user, 'Wine pairing') },
        { status: 403 }
      );
    }

    const aiLimited = await limitAiRequest(userId);
    if (aiLimited) return aiLimited;

    const body = await req.json();
    const { recipeName, ingredients, dietaryTags } = body;

    if (!recipeName || !ingredients) {
      return NextResponse.json(
        { error: 'Recipe name and ingredients are required' },
        { status: 400 }
      );
    }

    if (!hasRecipeAIKey()) {
      return NextResponse.json(
        { error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    // Create the wine pairing prompt
    const prompt = `As a sommelier, recommend wine pairings for this recipe:

Recipe: ${recipeName}
Ingredients: ${ingredients}
${dietaryTags?.length > 0 ? `Dietary considerations: ${dietaryTags.join(', ')}` : ''}

Provide 3 wine pairing recommendations in JSON format with the following structure:
{
  "pairings": [
    {
      "wineType": "Red/White/Rosé/Sparkling",
      "varietal": "Specific wine varietal",
      "description": "Why this wine pairs well with the dish",
      "servingTemp": "Serving temperature",
      "priceRange": "Budget-friendly/Mid-range/Premium"
    }
  ]
}

Keep descriptions concise (2-3 sentences).`;

    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: req.signal,
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sommelier specializing in wine and food pairings. Provide recommendations in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        // gemini-2.5-flash thinking tokens count against this budget
        max_tokens: 4000,
      }),
    }, { totalMs: 45_000 });

    if (!response.ok) {
      throw new Error('Failed to get wine pairing recommendations');
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;

    // Refused, truncated or otherwise unfinished answers are never accepted.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof content !== 'string' || !content) {
      throw new Error('No complete content in response');
    }

    // Try to parse JSON from the response
    let winePairing;
    try {
      winePairing = JSON.parse(extractJsonPayload(content));
    } catch {
      // Parser messages can quote model output, so log only the event.
      console.error('Failed to parse wine pairing JSON');
      // Return a default response if parsing fails
      winePairing = {
        pairings: [
          {
            wineType: 'Red',
            varietal: 'Pinot Noir',
            description: 'A versatile choice that complements many dishes with its light to medium body and balanced acidity.',
            servingTemp: '60-65°F (15-18°C)',
            priceRange: 'Mid-range'
          }
        ]
      };
    }

    return NextResponse.json(winePairing);
  } catch (error) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error('Error getting wine pairing:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to get wine pairing recommendations' },
      { status: 500 }
    );
  }
}

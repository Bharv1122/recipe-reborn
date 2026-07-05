import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';

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

    const body = await req.json();
    const { recipeName, ingredients, dietaryTags } = body;

    if (!recipeName || !ingredients) {
      return NextResponse.json(
        { error: 'Recipe name and ingredients are required' },
        { status: 400 }
      );
    }

    const apiKey = AI_API_KEY;
    if (!apiKey) {
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

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
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
    });

    if (!response.ok) {
      throw new Error('Failed to get wine pairing recommendations');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Try to parse JSON from the response
    let winePairing;
    try {
      winePairing = JSON.parse(extractJsonPayload(content));
    } catch (parseError) {
      console.error('Failed to parse wine pairing JSON:', parseError);
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
    console.error('Error getting wine pairing:', error);
    return NextResponse.json(
      { error: 'Failed to get wine pairing recommendations' },
      { status: 500 }
    );
  }
}

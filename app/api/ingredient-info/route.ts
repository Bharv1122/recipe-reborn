import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';

export const dynamic = 'force-dynamic';

// POST /api/ingredient-info - Get detailed ingredient information
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
    const { ingredient } = body;

    if (!ingredient || typeof ingredient !== 'string') {
      return NextResponse.json(
        { error: 'Ingredient name is required' },
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

    // Create the prompt for ingredient information
    const prompt = `Provide detailed information about this ingredient: "${ingredient}"

Return the information in this exact JSON format:
{
  "name": "Proper ingredient name",
  "category": "Vegetable/Fruit/Protein/Grain/Dairy/etc.",
  "nutrition": {
    "calories": "Per 100g",
    "protein": "Amount",
    "carbs": "Amount",
    "fat": "Amount",
    "fiber": "Amount",
    "vitamins": ["Key vitamins"]
  },
  "healthBenefits": [
    "Benefit 1",
    "Benefit 2",
    "Benefit 3"
  ],
  "substitutions": [
    {
      "ingredient": "Substitute name",
      "ratio": "1:1 or other ratio",
      "note": "Any important notes"
    }
  ],
  "allergens": ["List of common allergens"],
  "seasonality": "When it's in season",
  "storageType": "How to store it",
  "shelfLife": "How long it lasts"
}

Provide accurate, concise information. Return ONLY valid JSON.`;

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
            content: 'You are a nutrition expert and culinary specialist. Provide detailed, accurate ingredient information in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        // gemini-2.5-flash thinking tokens count against this budget
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get ingredient information');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse the JSON response
    let ingredientInfo;
    try {
      ingredientInfo = JSON.parse(extractJsonPayload(content));
    } catch (parseError) {
      console.error('Failed to parse ingredient info JSON:', parseError);
      // Return a default response if parsing fails
      ingredientInfo = {
        name: ingredient,
        category: 'Unknown',
        nutrition: {
          calories: 'Not available',
          protein: 'Not available',
          carbs: 'Not available',
          fat: 'Not available',
          fiber: 'Not available',
          vitamins: []
        },
        healthBenefits: ['Nutritional information currently unavailable'],
        substitutions: [],
        allergens: [],
        seasonality: 'Varies by region',
        storageType: 'Store in a cool, dry place',
        shelfLife: 'Varies'
      };
    }

    return NextResponse.json(ingredientInfo);
  } catch (error) {
    console.error('Error getting ingredient info:', error);
    return NextResponse.json(
      { error: 'Failed to get ingredient information' },
      { status: 500 }
    );
  }
}

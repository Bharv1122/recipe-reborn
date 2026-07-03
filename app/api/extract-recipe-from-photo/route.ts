import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'You must be logged in to extract recipes from photos' },
        { status: 401 }
      );
    }

    // Get the uploaded image from form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // Vision call — Gemini reads the label photo directly
    const apiKey = AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API configuration missing' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert culinary assistant. Analyze this image and determine what type of recipe-related content it contains.

This image could be:
1. A COMPLETE RECIPE from a cookbook or recipe card (with title, ingredients, and instructions)
2. A PRODUCT LABEL showing an ingredient list from processed/packaged food
3. A NUTRITION LABEL with ingredients

Return ONLY a valid JSON object with this exact structure:
{
  "type": "complete_recipe" OR "ingredient_list",
  "title": "recipe name" (if complete recipe) OR "Ingredients from [product name]" (if ingredient list),
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"] (if complete recipe, otherwise empty array),
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "dietaryTags": ["vegetarian", "gluten-free", etc]
}

IMPORTANT RULES:
- If this is a COMPLETE RECIPE: Extract title, all ingredients with measurements, and step-by-step instructions
- If this is a PRODUCT/NUTRITION LABEL: Set type to "ingredient_list", extract ALL ingredients from the label (even if the text is small), and leave instructions as empty array
- For ingredient lists: Be thorough - extract every single ingredient you can see, even preservatives and additives
- Estimate times and servings with reasonable defaults if not visible
- Infer dietary tags based on ingredients
- Return ONLY the JSON, no other text`;

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
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error Response:', errorText);
      console.error('AI API Status:', response.status);
      console.error('AI API Status Text:', response.statusText);
      
      // Try to parse error details
      let errorMessage = 'Failed to analyze recipe photo. Please try again.';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
        console.error('Parsed error:', errorData);
      } catch (e) {
        console.error('Could not parse error response');
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No recipe data extracted from photo' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let recipeData;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|```\n?/g, '').trim();
      recipeData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'Failed to parse recipe data. Please try with a clearer photo.' },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!recipeData.title || !recipeData.ingredients) {
      return NextResponse.json(
        { error: 'Incomplete recipe data extracted. Please try with a clearer photo.' },
        { status: 400 }
      );
    }

    // Ensure arrays are properly formatted
    recipeData.ingredients = Array.isArray(recipeData.ingredients)
      ? recipeData.ingredients
      : [recipeData.ingredients];
    recipeData.instructions = Array.isArray(recipeData.instructions)
      ? recipeData.instructions
      : [recipeData.instructions];
    recipeData.dietaryTags = Array.isArray(recipeData.dietaryTags)
      ? recipeData.dietaryTags
      : [];

    // Set defaults if missing
    recipeData.prepTime = recipeData.prepTime || '15 minutes';
    recipeData.cookTime = recipeData.cookTime || '30 minutes';
    recipeData.servings = recipeData.servings || 4;
    
    // Detect type (default to complete_recipe if not specified)
    const extractionType = recipeData.type || 'complete_recipe';

    return NextResponse.json({
      ...recipeData,
      type: extractionType
    });
  } catch (error) {
    console.error('Error extracting recipe from photo:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your photo' },
      { status: 500 }
    );
  }
}

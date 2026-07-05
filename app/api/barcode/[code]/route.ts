import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

// GET /api/barcode/[code] - Look up a packaged product by barcode via OpenFoodFacts
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const code = params?.code?.trim();

    // Real-world barcodes (EAN-8/13, UPC-A/E) are 6-14 digit numeric strings
    if (!code || !/^\d{6,14}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid barcode — expected a 6-14 digit number' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,ingredients_text`,
      {
        headers: {
          // OpenFoodFacts asks API consumers to identify their app
          'User-Agent': 'RecipeReborn/1.0 (https://recipereborn.com)',
        },
        cache: 'no-store',
      }
    );

    // OpenFoodFacts returns 404 (with a JSON body) for unknown barcodes
    if (response.status === 404) {
      return NextResponse.json({ name: '', ingredients_text: '', found: false });
    }

    if (!response.ok) {
      throw new Error(`OpenFoodFacts responded with ${response.status}`);
    }

    const data = await response.json();

    if (data?.status !== 1 || !data?.product) {
      return NextResponse.json({ name: '', ingredients_text: '', found: false });
    }

    // OpenFoodFacts wraps allergens in underscores (e.g. "_wheat_ flour")
    const ingredientsText = String(data.product.ingredients_text ?? '')
      .replace(/_/g, '')
      .trim();

    return NextResponse.json({
      name: String(data.product.product_name ?? '').trim(),
      ingredients_text: ingredientsText,
      found: true,
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to look up barcode' },
      { status: 500 }
    );
  }
}

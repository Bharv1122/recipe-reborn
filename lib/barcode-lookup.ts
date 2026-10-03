import { originalNutritionFromOpenFoodFactsProduct } from '@/lib/nutrition-facts';

export class InvalidBarcodeError extends Error {}

export function barcodeIngredientText(product: Record<string, unknown>): string {
  // Use complete label text only, never reconstruct a potentially incomplete
  // allergen list from the database's parsed ingredient fragments.
  for (const field of ['ingredients_text', 'ingredients_text_en', 'ingredients_text_es', 'ingredients_text_fr', 'ingredients_text_de', 'ingredients_text_it']) {
    const value = product[field];
    if (typeof value === 'string' && value.trim()) return value.replace(/_/g, '').trim();
  }
  return '';
}

export async function lookupBarcode(rawCode: string) {
  const code = rawCode.trim();
  if (!/^\d{6,14}$/.test(code)) {
    throw new InvalidBarcodeError('Invalid barcode — expected a 6-14 digit number');
  }

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,ingredients_text,ingredients_text_en,ingredients_text_es,ingredients_text_fr,ingredients_text_de,ingredients_text_it,serving_size,nutriments`,
    {
      headers: { 'User-Agent': 'RecipeReborn/1.0 (https://recipereborn.com)' },
      cache: 'no-store',
    },
  );
  if (response.status === 404) return { name: '', ingredients_text: '', found: false };
  if (!response.ok) throw new Error(`OpenFoodFacts responded with ${response.status}`);

  const data = await response.json();
  if (data?.status !== 1 || !data?.product) return { name: '', ingredients_text: '', found: false };

  return {
    name: String(data.product.product_name ?? '').trim(),
    ingredients_text: barcodeIngredientText(data.product),
    originalNutrition: originalNutritionFromOpenFoodFactsProduct(data.product),
    found: true,
  };
}

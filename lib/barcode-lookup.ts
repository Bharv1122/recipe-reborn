import { originalNutritionFromOpenFoodFactsProduct } from '@/lib/nutrition-facts';

export class InvalidBarcodeError extends Error {}

export async function lookupBarcode(rawCode: string) {
  const code = rawCode.trim();
  if (!/^\d{6,14}$/.test(code)) {
    throw new InvalidBarcodeError('Invalid barcode — expected a 6-14 digit number');
  }

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,ingredients_text,serving_size,nutriments`,
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
    ingredients_text: String(data.product.ingredients_text ?? '').replace(/_/g, '').trim(),
    originalNutrition: originalNutritionFromOpenFoodFactsProduct(data.product),
    found: true,
  };
}

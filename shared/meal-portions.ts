// A narrow AI-output sanity check, not a nutrition recommendation or a scaler.
// Only unambiguous, weight-measured meat is checked; never guess counts or yields.
export function hasBulkMeatPortion(ingredients: readonly string[], servings: number): boolean {
  if (!Number.isFinite(servings) || servings <= 0) return false;
  let ounces = 0;
  for (const line of ingredients) {
    const normalized = line.replace(/^(\s*\d+)[-–](\d+\/\d+)(?=\s)/, '$1 $2').replace(/(\d)?([¼½¾])/g, (_, whole, fraction: string) =>
      `${whole ? `${whole} ` : ''}${({ '¼': '1/4', '½': '1/2', '¾': '3/4' })[fraction]}`);
    const match = normalized.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg)\b\.?\s+(.+)$/i);
    if (!match) continue;
    // A lean/fat percentage describes the meat, not a separate cooking fat.
    const food = match[3].replace(/\b\d+(?:\.\d+)?\s*(?:%|percent)\s*(?:lean|fat)\b/gi, '');
    if (!/\b(?:sausage|sausages|beef|pork|chicken|turkey|lamb|veal|venison|bison|steak)\b/i.test(food) ||
        /\b(?:broth|stock|gravy|fat|lard|tallow|bone[- ]in|whole|bones?|carcass)\b/i.test(food)) continue;
    const amount = match[1].split(/\s+/).reduce((sum, part) => {
      const [a, b] = part.split('/').map(Number);
      return sum + (b === undefined ? a : a / b);
    }, 0);
    const unit = match[2].toLowerCase();
    const factor = /^(?:pound|lb)/.test(unit) ? 16 : /^(?:kilogram|kg)/.test(unit) ? 35.274 : /^(?:gram|g)/.test(unit) ? 1 / 28.3495 : 1;
    if (Number.isFinite(amount)) ounces += amount * factor;
  }
  return ounces / servings > 12;
}

export const MEAL_PORTION_RULES = 'Choose practical meal portions for the requested number of people. Scale every ingredient together; never copy family-size amounts and merely label them as one serving. For a typical meat main, start around 4-6 oz boneless meat per serving and size vegetables and sides accordingly. More than 12 oz weighed boneless meat per serving is a likely batch-size error and will be rejected; correct the entire recipe, not just its serving label.';

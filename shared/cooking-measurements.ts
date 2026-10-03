// Cooking quantities use kitchen measures; nutrition retains standard g/mg units.
export const US_COOKING_MEASURES = 'For cooking ingredient quantities, use U.S. kitchen measurements: cups, tablespoons (tbsp), teaspoons (tsp), and counts. Use ounces (oz) or pounds (lb) for meat and foods that are not reliably measured by volume. Convert metric input quantities into these units in both ingredients and directions. Cup equivalents depend on the ingredient and its preparation; use approximate volumes only when reasonable, otherwise use ounces instead of inventing a gram-to-cup equivalence. Keep nutrition in its standard units (kcal, g, mg).';

export function hasMetricCookingMeasures(ingredients: string[]): boolean {
  return ingredients.some(line => /(?:\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:g|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\b/i.test(line));
}

const fractions: Record<string, string> = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const normalizeFractions = (line: string) => line.replace(/(\d)?([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_, whole, fraction) => `${whole ? `${whole} ` : ''}${fractions[fraction]}`);
const measurePattern = /(?<![\w/])(?<amount>\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?<unit>cups?|tablespoons?|tbsp|teaspoons?|tsp|grams?|g|kilograms?|kg|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|(?:fluid\s+|fl\s+)?ounces?|fl\.?\s*oz|oz|pounds?|lbs?|pints?|quarts?|gallons?)\b/gi;
function measures(line: string) {
  return [...normalizeFractions(line).matchAll(measurePattern)].map(match => {
    const amount = match.groups!.amount.split(/\s+/).reduce((sum, part) => {
      const [numerator, denominator] = part.replace(',', '.').split('/').map(Number);
      return sum + numerator / (denominator ?? 1);
    }, 0);
    const unit = match.groups!.unit.toLowerCase();
    const weight = /^(g|grams?|kg|kilograms?|oz|ounces?|lb|lbs|pounds?)$/.test(unit);
    const factor = /^kg|^kilogram/.test(unit) ? 1000 : /^g(?:ram|$)/.test(unit) ? 1 : /^lb|^pound/.test(unit) ? 453.59237 : weight ? 28.349523125
      : /^ml|^millilit/.test(unit) ? 1 : /^(l|lit)/.test(unit) ? 1000 : /^tsp|^teaspoon/.test(unit) ? 4.92892159375 : /^tbsp|^tablespoon/.test(unit) ? 14.78676478125 : /^cup/.test(unit) ? 236.5882365 : /^pint/.test(unit) ? 473.176473 : /^quart/.test(unit) ? 946.352946 : /^gallon/.test(unit) ? 3785.411784 : 29.5735295625;
    const prefix = normalizeFractions(line).slice(0, match.index);
    return { value: amount * factor, weight, approximate: /\b(?:about|approximately|approx\.?)\s*$/i.test(prefix) };
  });
}

export function equivalentCookingMeasurements(before: string, after: string): boolean {
  if (/\d,\d{3}\b/.test(before) || /\d,\d{3}\b/.test(after)) return false; // Ambiguous thousands/decimal separator.
  const original = measures(before), converted = measures(after);
  return original.length === converted.length && original.every((measure, index) => {
    const next = converted[index];
    if (!Number.isFinite(measure.value) || !Number.isFinite(next.value) || measure.value <= 0 || next.value <= 0) return false;
    // Mass-to-volume needs ingredient density, so explicitly label it approximate.
    if (measure.weight !== next.weight) return next.approximate;
    return Math.abs(next.value - measure.value) / measure.value <= 0.05;
  });
}
// Preserve food words, counts, temperatures, times and preparation details.
// Only a numeric cooking measure and an optional approximation word may change.
export function cookingMeasurementIdentity(line: string): string {
  return normalizeFractions(line)
    .replace(/\b(?:about|approximately|approx\.?)\s*/gi, '')
    .replace(measurePattern, ' MEASURE ')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Splits a shopping entry on commas or line breaks. Exact duplicates are kept
 * because Recipe Reborn shopping lists currently allow duplicate items.
 */
export function parseShoppingItems(value: string): string[] {
  return value
    .split(/[,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

import { z } from 'zod';

export const pantryLocationSchema = z.enum(['fridge', 'pantry', 'unknown']);

export const pantryInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.string().trim().max(40).nullable().default(null),
  location: pantryLocationSchema.default('unknown'),
});

export const pantryInventoryItemsSchema = z.array(pantryInventoryItemSchema).min(1).max(150);

export const pantryInventorySaveSchema = z.object({
  items: pantryInventoryItemsSchema,
  reviewConfirmed: z.literal(true),
});

export type PantryInventoryItem = z.infer<typeof pantryInventoryItemSchema>;

export function normalizePantryItems(items: PantryInventoryItem[]): PantryInventoryItem[] {
  const unique = new Map<string, PantryInventoryItem>();

  for (const item of items) {
    const name = item.name.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, {
        name,
        quantity: item.quantity?.trim() || null,
        location: item.location,
      });
      continue;
    }

    if (!existing.quantity && item.quantity?.trim()) existing.quantity = item.quantity.trim();
    if (existing.location === 'unknown' && item.location !== 'unknown') {
      existing.location = item.location;
    }
  }

  return [...unique.values()].slice(0, 150);
}

export function pantryItemsToText(items: PantryInventoryItem[]): string {
  return items
    .map((item) => item.quantity ? `${item.quantity} ${item.name}` : item.name)
    .join(', ');
}

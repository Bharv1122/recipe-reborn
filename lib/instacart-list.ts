export interface CopyableShoppingListItem {
  ingredient: string;
  quantity?: string | null;
  unit?: string | null;
  checked?: boolean;
}

export function formatItemsForInstacart(items: CopyableShoppingListItem[]) {
  return items
    .filter((item) => !item.checked && item.ingredient.trim())
    .map((item) => [item.quantity, item.unit, item.ingredient]
      .filter((part) => part?.trim())
      .join(' '))
    .join('\n');
}

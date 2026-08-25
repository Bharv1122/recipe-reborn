export type ScanRecipeHandoff = {
  source: 'label';
  origin: 'barcode' | 'label-photo';
  ingredients: string;
  context: string;
};

let pendingHandoff: ScanRecipeHandoff | null = null;

export function stageScanRecipeHandoff(handoff: ScanRecipeHandoff) {
  const ingredients = handoff.ingredients.trim();
  if (!ingredients) throw new Error('A scanned ingredient list is required.');
  pendingHandoff = {
    ...handoff,
    ingredients,
    context: handoff.context.trim(),
  };
}

export function takeScanRecipeHandoff() {
  const handoff = pendingHandoff;
  pendingHandoff = null;
  return handoff;
}

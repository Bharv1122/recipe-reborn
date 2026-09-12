type ShoppingDraft = { title: string; ingredients: string[] };
let pending: ShoppingDraft | null = null;

export function stageShoppingDraft(draft: ShoppingDraft) {
  pending = { title: draft.title, ingredients: [...draft.ingredients] };
}

export function takeShoppingDraft() {
  const draft = pending;
  pending = null;
  return draft;
}

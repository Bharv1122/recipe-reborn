import { apiRequest } from '@/services/api';
export type ImportDraft = { title: string; ingredients: string; instructions: string; prepTime: string; cookTime: string; servings: string; dietaryTags: string; reviewNotes: string };
export type ImportAdaptationAction = { type: 'substitute'; original: string; substitute: string } | { type: 'remove'; original: string } | { type: 'preferences'; oneRecipeDiet: string } | { type: 'measurements'; system: 'us' };
function text(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
function lines(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  const raw = text(value);
  if (raw.startsWith('[')) { try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) return lines(parsed); } catch { /* Preserve original text for review. */ } }
  return raw;
}
export function importDraft(value: unknown): ImportDraft {
  if (!value || typeof value !== 'object') throw new Error('The source did not return a readable recipe.');
  const recipe = value as Record<string, unknown>;
  const draft = { title: text(recipe.title), ingredients: lines(recipe.freshIngredients ?? recipe.ingredients ?? recipe.originalIngredients), instructions: lines(recipe.instructions), prepTime: text(recipe.prepTime), cookTime: text(recipe.cookTime), servings: text(recipe.servings), dietaryTags: Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags.map(text).filter(Boolean).join(', ') : text(recipe.dietaryTags), reviewNotes: lines(recipe.reviewNotes) };
  if (!draft.title || !draft.ingredients || !draft.instructions) throw new Error('A complete recipe with title, ingredients, and steps is required. Try a clearer source.');
  return draft;
}
export function importSnapshot(draft: ImportDraft, maxStepLength = 3000) {
  const ingredients = draft.ingredients.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const instructions = draft.instructions.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const dietaryTags = draft.dietaryTags.split(',').map(item => item.trim()).filter(Boolean);
  if (!draft.title.trim() || !ingredients.length || !instructions.length) throw new Error('Add a title, ingredients, and instructions before saving.');
  if ([draft.prepTime, draft.cookTime, draft.servings].some(value => value.trim().length > 100)) throw new Error('Keep times and servings under 100 characters.');
  if (draft.title.trim().length > 200 || ingredients.length > 150 || ingredients.some(item => item.length > 500) || instructions.length > 100 || instructions.some(item => item.length > maxStepLength) || dietaryTags.length > 30 || dietaryTags.some(item => item.length > 80)) throw new Error('This recipe is too long. Keep ingredients on separate lines and shorten lengthy steps or tags.');
  return { title: draft.title.trim(), freshIngredients: ingredients, instructions, dietaryTags, prepTime: draft.prepTime.trim(), cookTime: draft.cookTime.trim(), servings: draft.servings.trim() };
}
export function saveImportPayload(draft: ImportDraft, sourceDraft: ImportDraft = draft) {
  const recipe = importSnapshot(draft);
  const source = importSnapshot(sourceDraft);
  return { ...recipe, originalIngredients: source.freshIngredients.join('\n'), librarySource: 'imported' as const, importSourceSnapshot: source };
}
export function adaptImportedDraft(draft: ImportDraft, action: ImportAdaptationAction, signal?: AbortSignal) {
  return apiRequest<{ recipe: unknown; changeSummary: string; reviewNotes: string[]; quotaUsed: false }>('/api/import-recipe/adapt', {
    method: 'POST', signal, body: JSON.stringify({ recipe: importSnapshot(draft), action }),
  });
}

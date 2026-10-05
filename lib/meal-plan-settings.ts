import { z } from 'zod';

const terms = z.array(z.string().trim().min(1).max(200)).max(100);
export const savedPlanSettingsSchema = z.object({
  allergies: terms,
  dislikedIngredients: terms,
  dietaryPreferences: terms,
  // Account dislikes when the plan was generated. Optional: older and
  // hand-made plans lack it, so every current account dislike applies.
  accountDislikesAtCreation: terms.optional(),
});

// A one-plan dislike override stays authorized, but dislikes added to the
// account after generation still apply. Allergies never go through this.
export function effectiveDislikes(planned: string[], current: string[], baseline?: string[]) {
  const known = new Set((baseline ?? []).map(term => term.trim().toLowerCase()));
  return [...new Set([...planned, ...current.filter(term => !known.has(term.trim().toLowerCase()))])];
}

export function replacementSettings(value: unknown, profile: { allergies: string[]; dislikedIngredients: string[] }) {
  const parsed = savedPlanSettingsSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    allergies: [...new Set([...parsed.data.allergies, ...profile.allergies])],
    dislikedIngredients: effectiveDislikes(parsed.data.dislikedIngredients, profile.dislikedIngredients, parsed.data.accountDislikesAtCreation),
    dietaryPreferences: parsed.data.dietaryPreferences,
  };
}

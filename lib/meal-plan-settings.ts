import { z } from 'zod';

const terms = z.array(z.string().trim().min(1).max(200)).max(100);
export const savedPlanSettingsSchema = z.object({
  allergies: terms,
  dislikedIngredients: terms,
  dietaryPreferences: terms,
});

export function replacementSettings(value: unknown, profile: { allergies: string[]; dislikedIngredients: string[] }) {
  const parsed = savedPlanSettingsSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    allergies: [...new Set([...parsed.data.allergies, ...profile.allergies])],
    dislikedIngredients: [...new Set([...parsed.data.dislikedIngredients, ...profile.dislikedIngredients])],
    dietaryPreferences: parsed.data.dietaryPreferences,
  };
}

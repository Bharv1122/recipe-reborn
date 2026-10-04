// JSON contract shared by Android and web. No server dependencies.
import type { FreshNutritionEstimate } from '../shared/nutrition-facts';

export interface MealPlanPreview {
  id: string;
  expiresAt: string;
  weekStartDate: string;
  servings: number;
  savedPlanId: string | null;
  savedMeals: Record<string, string>;
  days: Array<{ day: string; meals: Record<string, {
    title: string; ingredients: string[]; instructions: string; servings: number;
    prepTime: string; cookTime: string; estimatedCalories: number | null;
    // Per-serving estimate for exactly this meal; absent or null when none was
    // calculated, or after a replacement or an edit sent without one.
    nutrition?: FreshNutritionEstimate | null;
  } | undefined> }>;
}
export interface MealPlanPreviewSummary { id: string; expiresAt: string; weekStartDate: string }
export type MealPlanPreviewMeal = NonNullable<MealPlanPreview['days'][number]['meals'][string]> & { dietaryTags?: string[] };

// POST /api/meal-plans/drafts/[id]/meals -> { draft: MealPlanPreview }.
// expectedMeal is the meal as last shown; 409 means it changed or the plan was
// saved (body then includes savedPlanId). Recipe/plan rows are never written.
// An edit may send the RecipeDetail estimate for the edited meal; it is kept
// with that meal and copied to the recipe's comparison snapshot on save.
// Without it, the edited meal has no estimate. A nutrition echo in
// expectedMeal is ignored for conflicts.
type MealPlanPreviewSlot = {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  expectedMeal: MealPlanPreviewMeal;
};
export type MealPlanPreviewChange =
  | (MealPlanPreviewSlot & { kind: 'replace' })
  | (MealPlanPreviewSlot & { kind: 'edit'; recipe: {
    title: string; freshIngredients: string[]; instructions: string[];
    prepTime: string; cookTime: string; servings: string; dietaryTags?: string[];
  }; nutrition?: FreshNutritionEstimate | null });

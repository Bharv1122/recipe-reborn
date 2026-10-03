// JSON contract shared by Android and web. No server dependencies.
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
  } | undefined> }>;
}
export interface MealPlanPreviewSummary { id: string; expiresAt: string; weekStartDate: string }

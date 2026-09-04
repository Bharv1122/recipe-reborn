CREATE UNIQUE INDEX "MealPlanRecipe_mealPlanId_recipeId_day_mealType_key"
ON "MealPlanRecipe"("mealPlanId", "recipeId", "day", "mealType");

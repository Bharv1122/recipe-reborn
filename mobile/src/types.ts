export interface MobileUser {
  id: string;
  email: string | null;
  name: string | null;
  allergies?: string[];
  dislikedIngredients?: string[];
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface ShoppingItem {
  id: string;
  shoppingListId: string;
  ingredient: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  order: number;
}

export interface ShoppingList {
  id: string;
  name: string;
  notes: string | null;
  updatedAt: string;
  items: ShoppingItem[];
}

export interface RecipeSummary {
  id: string;
  title: string;
  dietaryTags: string[];
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  rating: number | null;
  calories: number | null;
  createdAt: string;
}

export interface Recipe extends RecipeSummary {
  originalIngredients: string;
  freshIngredients: string;
  instructions: string;
  notes: string | null;
  estimatedCostPerServing?: number | null;
  storeBoughtCost?: number | null;
}

export interface GeneratedRecipe {
  title: string;
  freshIngredients: string[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  estimatedCostPerServing?: number;
  storeBoughtCost?: number;
}

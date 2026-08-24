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

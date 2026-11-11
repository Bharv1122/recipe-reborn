import { formatIngredient, type CatalogRecipe } from '@/lib/public-recipes';
import type { KitchenRecipe } from '@/lib/kitchen/engine';

const minutes = (n: number) => (n > 0 ? `${n} min` : undefined);

/** Catalog recipe → the shape both kitchen surfaces render. */
export function catalogToKitchenRecipe(r: CatalogRecipe): KitchenRecipe {
  return {
    id: r.id,
    title: r.title,
    ingredients: r.ingredients.map((i) => formatIngredient(i)),
    steps: r.steps,
    servings: String(r.servings),
    prepTime: minutes(r.prepMinutes),
    cookTime: minutes(r.cookMinutes),
    isSample: true,
    replaces: r.replaces,
  };
}

import { z } from 'zod';
import { recipeComparisonSchema } from './recipe-comparison-validation';
import { LIBRARY_SOURCES } from './recipe-library';
import { importedRecipeSnapshotSchema } from './import-recipe-adaptation';

// JSON clients represent unavailable optional fields as null as well as omission.
// Match photo-import review limits, including longer handwritten timing notes.
const optionalMetadata = z.preprocess(value => value === null ? undefined : value, importedRecipeSnapshotSchema.shape.prepTime.optional());
const optionalCost = z.number().nonnegative().finite().nullish().transform(value => value ?? undefined);

export const recipeSaveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  originalIngredients: z.string().trim().min(1).max(50000),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(1).max(100),
  dietaryTags: z.array(z.string().trim().min(1).max(80)).max(30).nullish().transform(value => value ?? []),
  prepTime: optionalMetadata,
  cookTime: optionalMetadata,
  servings: optionalMetadata,
  estimatedCostPerServing: optionalCost,
  storeBoughtCost: optionalCost,
  comparisonSnapshot: recipeComparisonSchema.optional(),
  librarySource: z.enum(LIBRARY_SOURCES).exclude(['meal_plan']).default('generated'),
  importSourceSnapshot: importedRecipeSnapshotSchema.optional(),
});


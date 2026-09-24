import { z } from 'zod';

const nutrient = z.number().finite().nonnegative().nullable();
const values = z.object({
  calories: nutrient, protein: nutrient, carbs: nutrient,
  fat: nutrient, fiber: nutrient, sodium: nutrient,
});
const label = z.string().trim().min(1).max(500);

export const recipeComparisonSchema = z.object({
  version: z.literal(1),
  source: z.enum(['label', 'pantry', 'dish', 'random']),
  detectedAdditives: z.array(z.string().trim().min(1).max(500)).max(150).optional(),
  originalProductName: label.nullable().optional(),
  originalNutrition: z.object({
    values,
    basisLabel: label,
    sourceLabel: label,
    servingsPerContainer: z.number().finite().positive().nullable(),
    source: z.enum(['label_scan', 'barcode', 'typed']),
    accuracy: z.literal('exact'),
    // A missing review flag must not turn scanned data into confirmed data.
    reviewRequired: z.boolean().default(true),
  }).nullable(),
  freshNutrition: values.extend({
    perServing: z.literal(true),
    accuracy: z.literal('estimated'),
    basisLabel: label,
    sourceLabel: label,
  }).nullable(),
}).refine((value) => value.source === 'label' || value.originalNutrition === null,
  'Only label recipes can include package nutrition');

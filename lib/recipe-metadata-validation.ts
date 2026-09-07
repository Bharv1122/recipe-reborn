import { z } from 'zod';

export const RECIPE_METADATA_MAX_LENGTH = 80;

export const optionalRecipeMetadataSchema = z.string().trim().max(RECIPE_METADATA_MAX_LENGTH).optional();
export const requiredRecipeMetadataSchema = z.string().trim().min(1).max(RECIPE_METADATA_MAX_LENGTH);

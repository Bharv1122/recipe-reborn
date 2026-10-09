import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  PUBLIC_RECIPES,
  formatIngredient,
  getPublicRecipe,
  searchPublicRecipes,
  shoppingListFor,
  type CatalogRecipe,
} from '@/lib/public-recipes';
import { KNOWN_SUBSTITUTION_INGREDIENTS, findSubstitutions } from '@/lib/substitutions';

/**
 * The Recipe Reborn MCP server (used by the Muse connector at /api/mcp).
 *
 * v1 is PUBLIC and read-only on purpose:
 *   - every tool reads only the house catalog in lib/public-recipes.ts and
 *     the swap table in lib/substitutions.ts — no database, no user data
 *   - no tool calls an AI model, so there is no per-call cost to abuse
 *   - nothing takes or returns personal information
 * Account-linked tools (saved recipes, shopping lists) would need OAuth and
 * are intentionally left for a later version.
 */

export const SITE_URL = 'https://recipereborn.com';
export const MCP_SERVER_NAME = 'recipe-reborn';
export const MCP_SERVER_VERSION = '1.0.0';

const recipeIds = PUBLIC_RECIPES.map((r) => r.id);

const kitchenUrl = (id: string) => `${SITE_URL}/kitchen/${id}`;

function recipeCard(r: CatalogRecipe) {
  return {
    id: r.id,
    title: r.title,
    replaces: r.replaces,
    summary: r.summary,
    servings: r.servings,
    totalMinutes: r.prepMinutes + r.cookMinutes,
    tags: r.tags,
    kitchenModeUrl: kitchenUrl(r.id),
  };
}

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function notFound(id: string) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: `No recipe with id "${id}". Use search_recipes to find one. Known ids: ${recipeIds.join(', ')}`,
      },
    ],
  };
}

// Plain, bounded strings: trims, caps length, and rejects control characters
// so nothing odd gets echoed back into the model's context.
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]*$/, 'Control characters are not allowed');

const recipeIdSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Recipe ids are lowercase letters, numbers and dashes')
  .describe('A recipe id returned by search_recipes, e.g. "rr-simple-marinara".');

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createRecipeRebornMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions:
        'Recipe Reborn helps people cook homemade versions of packaged foods. ' +
        'Use search_recipes to find a recipe, get_recipe for the full ingredients and steps, ' +
        'shopping_list_for_recipe for a grocery list grouped by aisle, and substitute_ingredient ' +
        'for cooking swaps. Each recipe includes a kitchenModeUrl that opens hands-free, ' +
        'step-by-step cooking mode on a tablet or headset.',
    }
  );

  server.registerTool(
    'search_recipes',
    {
      title: 'Search homemade recipes',
      description:
        'Search Recipe Reborn’s public collection of homemade versions of common packaged foods ' +
        '(soups, sauces, dressings, snacks, breakfasts). Returns short recipe cards with ids.',
      inputSchema: {
        query: safeText(120)
          .optional()
          .describe('What to cook or what packaged food to replace, e.g. "ranch dressing" or "granola bars". Leave empty to list everything.'),
        tag: z
          .enum(['vegetarian', 'vegan', 'kid-friendly', 'quick', 'make-ahead', 'one-pot', 'no-cook', 'snack', 'breakfast', 'sheet-pan', 'pantry'])
          .optional()
          .describe('Only return recipes with this tag.'),
        maxTotalMinutes: z.number().int().min(5).max(600).optional().describe('Only recipes with prep + cook time at or under this many minutes.'),
        limit: z.number().int().min(1).max(10).optional().describe('Maximum results (default 5).'),
      },
      annotations: { title: 'Search homemade recipes', ...READ_ONLY },
    },
    async ({ query, tag, maxTotalMinutes, limit }) => {
      const results = searchPublicRecipes({ query, tag, maxTotalMinutes, limit });
      return json({
        count: results.length,
        results: results.map(recipeCard),
        ...(results.length === 0 && {
          hint: 'No match. Try a broader word such as "soup", "sauce", "snack" or "breakfast", or leave the query empty to list all recipes.',
        }),
      });
    }
  );

  server.registerTool(
    'get_recipe',
    {
      title: 'Get a recipe',
      description:
        'Get the full ingredient list and numbered steps for one Recipe Reborn recipe, optionally scaled to a number of servings.',
      inputSchema: {
        recipeId: recipeIdSchema,
        servings: z.number().int().min(1).max(48).optional().describe('Scale ingredient amounts to this many servings.'),
      },
      annotations: { title: 'Get a recipe', ...READ_ONLY },
    },
    async ({ recipeId, servings }) => {
      const r = getPublicRecipe(recipeId);
      if (!r) return notFound(recipeId);
      const target = servings ?? r.servings;
      const scale = target / r.servings;
      return json({
        ...recipeCard(r),
        servings: target,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        ingredients: r.ingredients.map((i) => formatIngredient(i, scale)),
        steps: r.steps.map((text, n) => `${n + 1}. ${text}`),
        contains: r.contains,
        allergenNote:
          'Common allergens are listed for convenience only. Always check your own ingredient labels.',
        ...(scale !== 1 && { scalingNote: 'Amounts are scaled; cooking times stay the same.' }),
      });
    }
  );

  server.registerTool(
    'shopping_list_for_recipe',
    {
      title: 'Shopping list for a recipe',
      description:
        'Build a grocery list for a Recipe Reborn recipe, scaled to the number of servings and grouped by store aisle.',
      inputSchema: {
        recipeId: recipeIdSchema,
        servings: z.number().int().min(1).max(48).optional().describe('How many servings to shop for (default: the recipe’s own yield).'),
      },
      annotations: { title: 'Shopping list for a recipe', ...READ_ONLY },
    },
    async ({ recipeId, servings }) => {
      const r = getPublicRecipe(recipeId);
      if (!r) return notFound(recipeId);
      const target = servings ?? r.servings;
      return json({
        recipeId: r.id,
        title: r.title,
        servings: target,
        aisles: shoppingListFor(r, target),
        kitchenModeUrl: kitchenUrl(r.id),
      });
    }
  );

  server.registerTool(
    'substitute_ingredient',
    {
      title: 'Substitute an ingredient',
      description:
        'Suggest common cooking and baking swaps for an ingredient you are out of (e.g. eggs, buttermilk, butter, heavy cream, cornstarch), with ratios and how the result changes.',
      inputSchema: {
        ingredient: safeText(80).min(2).describe('The ingredient to replace, e.g. "buttermilk" or "2 eggs".'),
      },
      annotations: { title: 'Substitute an ingredient', ...READ_ONLY },
    },
    async ({ ingredient }) => {
      const found = findSubstitutions(ingredient);
      if (!found) {
        return json({
          ingredient,
          options: [],
          hint: `No swap on file for that ingredient. Swaps are available for: ${KNOWN_SUBSTITUTION_INGREDIENTS.join(', ')}.`,
        });
      }
      return json({
        ingredient,
        matched: found.matched,
        options: found.options,
        note: 'Swaps change flavor and texture. If you are cooking around a food allergy, check every product label.',
      });
    }
  );

  return server;
}

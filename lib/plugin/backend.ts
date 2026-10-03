import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ENTITLEMENT_SELECT, hasPremiumAccess } from '@/lib/entitlement';
import { POST as generateRecipe } from '@/app/api/generate-recipe/route';
import { POST as generatePlan } from '@/app/api/meal-plans/generate/route';
import { POST as saveRecipe } from '@/app/api/mobile/recipes/route';
import { PluginError } from './oauth';
import type { Backend, Action } from './tools';

function lines(value: string) {
  try { const data = JSON.parse(value); if (Array.isArray(data)) return data.map(String); } catch { /* Older newline rows. */ }
  return value.split('\n').filter(Boolean);
}
const recipeSelect = { id: true, title: true, freshIngredients: true, instructions: true, dietaryTags: true, servings: true, prepTime: true, cookTime: true } as const;
/** Leading amounts only. Never rewrite oven temperature, cook time, or package size. */
export function scaleLine(line: string, factor: number) {
  if (factor === 1) return line;
  const fractions: Record<string, number> = { '¼': .25, '½': .5, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
  return line.replace(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?[¼½¾⅓⅔⅛]?|[¼½¾⅓⅔⅛])(?=\s|$)/, amount => {
    let n: number;
    const suffix = amount.slice(-1);
    if (fractions[suffix]) n = (Number(amount.slice(0, -1)) || 0) + fractions[suffix];
    else if (amount.includes('/')) { const parts = amount.split(/\s+/); const [a, b] = parts.pop()!.split('/').map(Number); n = (Number(parts[0]) || 0) + a / b; }
    else n = Number(amount);
    return Number.isFinite(n) ? String(Math.round(n * factor * 1000) / 1000) : amount;
  });
}
async function ownedRecipe(userId: string, id: string) {
  const row = await prisma.recipe.findFirst({ where: { id, userId }, select: recipeSelect });
  if (!row) throw new PluginError('recipe_not_found', 404);
  return { ...row, freshIngredients: lines(row.freshIngredients), instructions: lines(row.instructions) };
}
async function account(userId: string) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { ...ENTITLEMENT_SELECT, generationCount: true } });
  if (!row) throw new PluginError('account_not_found', 401);
  return { ...row, premium: hasPremiumAccess(row) };
}
/** Explicit in-process bridge. No incoming OAuth token is forwarded or sent over HTTP.
 * Minted 60s credentials stay inside this process and only enter the fixed existing
 * route handlers below. Their ownership, safety, trial and usage checks still run.
 */
function internalRequest(userId: string, path: string, body: unknown) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new PluginError('server_not_configured', 503);
  const token = jwt.sign({ type: 'access' }, secret, { subject: userId, issuer: 'recipe-reborn', audience: 'recipe-reborn-mobile', expiresIn: 60, algorithm: 'HS256' });
  return new NextRequest(`https://recipe-reborn.internal${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
export async function routeResult(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new PluginError(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'request_failed', response.status); }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return { result: await response.json() };
  const reader = response.body!.getReader(), decoder = new TextDecoder();
  let buffer = '', total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length; if (total > 1_000_000) throw new PluginError('generation_response_too_large', 502);
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        for (const line of event.split('\n')) if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.status === 'error') throw new PluginError(data.message || 'generation_failed', 422);
          if (data.status === 'completed') return { recipe: data.result, saved: false };
        }
      }
    }
    throw new PluginError('generation_incomplete', 502);
  } finally { await reader.cancel(); reader.releaseLock(); }
}
async function execute(userId: string, action: Action): Promise<Record<string, unknown>> {
  const user = await account(userId);
  if (action.kind === 'generate_recipe' && user.subscriptionTier !== 'free' && !user.premium) throw new PluginError('membership_inactive', 403);
  if (action.kind === 'generate_meal_plan' && !user.premium) throw new PluginError('premium_required', 403);
  switch (action.kind) {
    case 'generate_recipe': return routeResult(await generateRecipe(internalRequest(userId, '/api/generate-recipe', { ingredients: action.ingredients, dietaryRestriction: action.dietaryRestriction, generationId: randomUUID() })));
    case 'generate_meal_plan': return routeResult(await generatePlan(internalRequest(userId, '/api/meal-plans/generate', { ...action, allergies: [], dislikedIngredients: [] })));
    case 'save_recipe': { const { kind, ...recipe } = action; void kind; return routeResult(await saveRecipe(internalRequest(userId, '/api/mobile/recipes', recipe))); }
    case 'create_shopping_list': {
      const ids = [...new Set(action.recipeIds)];
      const result = await prisma.$transaction(async tx => {
        const recipes = await tx.recipe.findMany({ where: { userId, id: { in: ids } }, select: { id: true, title: true, freshIngredients: true } });
        if (recipes.length !== ids.length) throw new PluginError('recipe_not_found', 404);
        const items = recipes.flatMap(r => lines(r.freshIngredients).map(ingredient => ({ ingredient, recipeId: r.id, recipeTitle: r.title })));
        if (items.length > 1000) throw new PluginError('too_many_ingredients');
        return tx.shoppingList.create({ data: { userId, name: action.name, notes: 'Created with Recipe Reborn plugin. Ingredient lines retain their original quantities.', items: { create: items.map((item, order) => ({ ...item, order })) } }, select: { id: true, name: true, items: true } });
      });
      return { shoppingList: result };
    }
  }
}
export const backend: Backend = {
  account,
  search: async (userId, query, offset) => ({ recipes: await prisma.recipe.findMany({ where: { userId, title: { contains: query, mode: 'insensitive' } }, select: { id: true, title: true, dietaryTags: true, servings: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: 20 }), offset, pageSize: 20 }),
  recipe: ownedRecipe,
  plans: async (userId, offset) => ({ mealPlans: await prisma.mealPlan.findMany({ where: { userId }, select: { id: true, name: true, weekStartDate: true, mealPlanRecipes: { where: { recipe: { userId } }, select: { day: true, mealType: true, recipe: { select: { id: true, title: true } } } } }, orderBy: [{ weekStartDate: 'desc' }, { id: 'asc' }], skip: offset, take: 10 }), offset, pageSize: 10 }),
  shopping: async (userId, offset) => ({ shoppingLists: await prisma.shoppingList.findMany({ where: { userId }, select: { id: true, name: true, items: { select: { id: true, ingredient: true, quantity: true, unit: true, checked: true }, take: 500, orderBy: { order: 'asc' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: 10 }), offset, pageSize: 10, itemLimitPerList: 500 }),
  scale: async (userId, id, factor) => { const recipe = await ownedRecipe(userId, id); return { ...recipe, freshIngredients: recipe.freshIngredients.map(line => scaleLine(line, factor)), factor, saved: false, note: 'Only leading ingredient amounts change. Check yield, seasoning, pan size, and cooking time yourself.' }; },
  wine: async (userId, id) => {
    const user = await account(userId); if (!user.premium) throw new PluginError('premium_required', 403);
    const recipe = await prisma.recipe.findFirst({ where: { id, userId }, select: { winePairing: true } });
    if (!recipe) throw new PluginError('recipe_not_found', 404);
    if (!recipe.winePairing) return { available: false, message: 'No saved wine pairing. New wine generation is not exposed by this plugin version.' };
    try { return { available: true, pairing: JSON.parse(recipe.winePairing), note: 'For adults of legal drinking age only.' }; } catch { throw new PluginError('saved_pairing_unreadable', 422); }
  },
  execute,
};

import { z } from 'zod';
import { hash, opaque, PluginError, type Principal } from './oauth';
import type { PluginStore } from './store';

const id = z.string().trim().min(1).max(128);
const tags = z.array(z.string().trim().min(1).max(80)).max(20);
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('generate_recipe'), ingredients: z.string().trim().min(2).max(10000), dietaryRestriction: z.string().max(200).default('None') }).strict(),
  z.object({ kind: z.literal('generate_meal_plan'), weekStartDate: z.iso.date(), servings: z.number().int().min(1).max(8), mealTypes: z.array(z.enum(['breakfast', 'lunch', 'dinner', 'snack'])).min(1).max(4), dietaryPreferences: tags.default([]) }).strict(),
  z.object({ kind: z.literal('save_recipe'), title: z.string().trim().min(1).max(200), originalIngredients: z.string().min(1).max(10000), freshIngredients: z.array(z.string().min(1).max(500)).min(1).max(150), instructions: z.array(z.string().min(1).max(3000)).min(1).max(100), dietaryTags: tags.default([]), prepTime: z.string().max(80).optional(), cookTime: z.string().max(80).optional(), servings: z.string().max(80).optional() }).strict(),
  z.object({ kind: z.literal('create_shopping_list'), recipeIds: z.array(id).min(1).max(20), name: z.string().trim().min(1).max(100) }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export interface Backend {
  account(userId: string): Promise<Record<string, unknown>>;
  search(userId: string, query: string, offset: number): Promise<Record<string, unknown>>;
  recipe(userId: string, recipeId: string): Promise<Record<string, unknown>>;
  plans(userId: string, offset: number): Promise<Record<string, unknown>>;
  shopping(userId: string, offset: number): Promise<Record<string, unknown>>;
  scale(userId: string, recipeId: string, factor: number): Promise<Record<string, unknown>>;
  wine(userId: string, recipeId: string): Promise<Record<string, unknown>>;
  execute(userId: string, action: Action): Promise<Record<string, unknown>>;
}
export const requiredScopes = (action: Action): string[] => ({
  generate_recipe: ['ai:generate'], generate_meal_plan: ['ai:generate', 'plans:write'],
  save_recipe: ['recipes:write'], create_shopping_list: ['recipes:read', 'shopping:write'],
})[action.kind];
export function requireScopes(principal: Principal, scopes: string[]) {
  if (scopes.some(s => !principal.scopes.includes(s))) throw new PluginError('insufficient_scope', 403, scopes);
}
export class PluginTools {
  constructor(readonly store: PluginStore, readonly backend: Backend) {}
  async check(p: Principal, scopes: string[]) {
    requireScopes(p, scopes);
    await this.backend.account(p.userId); // Live account existence check, including deleted accounts.
    if (!await this.store.limit(`calls:${p.userId}`, 60, 60)) throw new PluginError('rate_limited', 429);
  }
  async prepare(p: Principal, raw: unknown) {
    const action = actionSchema.parse(raw);
    await this.check(p, requiredScopes(action));
    // Preview all source recipes now; execution rechecks ownership.
    const sources = action.kind === 'create_shopping_list' ? await Promise.all([...new Set(action.recipeIds)].map(id => this.backend.recipe(p.userId, id))) : [];
    const confirmationId = opaque();
    await this.store.put(`action:${hash(confirmationId)}`, { userId: p.userId, grantId: p.grantId, action }, 300);
    return { confirmationId, action, sourceTitles: sources.map(r => r.title), expiresIn: 300,
      effects: action.kind === 'generate_recipe' ? 'Uses recipe generation allowance; returns an unsaved recipe. Saving is a separate action.' : action.kind === 'generate_meal_plan' ? 'Uses AI allowance and saves a new weekly plan and its recipes atomically. Existing plans are unchanged.' : action.kind === 'save_recipe' ? 'Creates one saved recipe. No existing recipe changes.' : 'Creates one shopping list from the selected owned recipes.',
      confirmationRequired: true };
  }
  async execute(p: Principal, confirmationId: string) {
    const key = `action:${hash(confirmationId)}`;
    const prepared = await this.store.get<{ userId: string; grantId: string; action: Action }>(key);
    if (!prepared || prepared.userId !== p.userId || prepared.grantId !== p.grantId) throw new PluginError('confirmation_expired_or_invalid', 409);
    await this.check(p, requiredScopes(prepared.action));
    if (prepared.action.kind.startsWith('generate_')) {
      if (!await this.store.limit(`ai-minute:${p.userId}`, 20, 60) || !await this.store.limit(`ai-day:${p.userId}`, 300, 86400)) throw new PluginError('ai_limit_reached', 429);
    }
    // Consume BEFORE executing. Retries never duplicate a plan or spend AI quota again.
    if (!await this.store.take(key)) throw new PluginError('confirmation_already_used', 409);
    return this.backend.execute(p.userId, prepared.action);
  }
}

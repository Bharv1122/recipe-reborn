import type { SQLiteDatabase } from 'expo-sqlite';
import type { Recipe } from '@/types';

const operations = new WeakMap<SQLiteDatabase, Promise<unknown>>();
const revisions = new WeakMap<SQLiteDatabase, number>();
function serial<T>(db: SQLiteDatabase, run: () => Promise<T>): Promise<T> {
  const next = (operations.get(db) ?? Promise.resolve()).catch(() => undefined).then(run);
  operations.set(db, next.catch(() => undefined));
  return next;
}
export function recipeCacheRevision(db: SQLiteDatabase) { return revisions.get(db) ?? 0; }
export async function migrateRecipeCache(db: SQLiteDatabase) {
  await db.execAsync('CREATE TABLE IF NOT EXISTS saved_recipe_snapshots (owner_id TEXT NOT NULL, recipe_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(owner_id, recipe_id));');
}
export function clearRecipeCache(db: SQLiteDatabase) {
  revisions.set(db, recipeCacheRevision(db) + 1);
  return serial(db, async () => { await db.runAsync('DELETE FROM saved_recipe_snapshots'); });
}
export function forgetCachedRecipe(db: SQLiteDatabase, owner: string, id: string) {
  // Invalidate in-flight fetches so a completed deletion cannot be resurrected.
  revisions.set(db, recipeCacheRevision(db) + 1);
  return serial(db, async () => { await db.runAsync('DELETE FROM saved_recipe_snapshots WHERE owner_id = ? AND recipe_id = ?', owner, id); });
}
export function cacheRecipe(db: SQLiteDatabase, owner: string, recipe: Recipe, revision: number, current: () => boolean) {
  return serial(db, async () => {
    if (!current() || revision !== recipeCacheRevision(db)) return;
    if (!recipe.savedAt) {
      await db.runAsync('DELETE FROM saved_recipe_snapshots WHERE owner_id = ? AND recipe_id = ?', owner, recipe.id);
      return;
    }
    await db.runAsync('INSERT OR REPLACE INTO saved_recipe_snapshots VALUES (?, ?, ?, ?)', owner, recipe.id, JSON.stringify(recipe), Date.now());
    await db.runAsync('DELETE FROM saved_recipe_snapshots WHERE owner_id = ? AND recipe_id NOT IN (SELECT recipe_id FROM saved_recipe_snapshots WHERE owner_id = ? ORDER BY updated_at DESC, recipe_id LIMIT 100)', owner, owner);
  });
}
export function pruneRecipeCache(db: SQLiteDatabase, owner: string, ids: string[], revision: number, current: () => boolean) {
  return serial(db, async () => {
    if (!current() || revision !== recipeCacheRevision(db)) return;
    const allowed = new Set(ids);
    const rows = await db.getAllAsync<{ recipe_id: string }>('SELECT recipe_id FROM saved_recipe_snapshots WHERE owner_id = ?', owner);
    for (const row of rows) if (!allowed.has(row.recipe_id)) await db.runAsync('DELETE FROM saved_recipe_snapshots WHERE owner_id = ? AND recipe_id = ?', owner, row.recipe_id);
  });
}
export function readCachedRecipes(db: SQLiteDatabase, owner: string) {
  return serial(db, async () => {
    const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM saved_recipe_snapshots WHERE owner_id = ? ORDER BY updated_at DESC, recipe_id', owner);
    return rows.flatMap(row => {
      try {
        const recipe: Recipe = JSON.parse(row.payload);
        return recipe && typeof recipe.id === 'string' && typeof recipe.title === 'string' && recipe.savedAt && Array.isArray(recipe.dietaryTags) ? [recipe] : [];
      } catch { return []; }
    });
  });
}

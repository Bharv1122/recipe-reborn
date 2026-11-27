import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Recipe } from '../mobile/src/types';
import { cacheRecipe, clearRecipeCache, forgetCachedRecipe, migrateRecipeCache, pruneRecipeCache, readCachedRecipes, recipeCacheRevision } from '../mobile/src/services/recipe-cache';

async function main() {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (query: string) => { sql.exec(query); },
    runAsync: async (query: string, ...args: (string | number)[]) => sql.prepare(query).run(...args),
    getAllAsync: async (query: string, ...args: (string | number)[]) => sql.prepare(query).all(...args),
  } as unknown as SQLiteDatabase;
  await migrateRecipeCache(db);
  const recipe = (id: string) => ({ id, title: id, savedAt: '2026-11-26', dietaryTags: [], freshIngredients: '1 cup rice', instructions: 'Cook rice' }) as Recipe;
  const save = (owner: string, id: string) => cacheRecipe(db, owner, recipe(id), recipeCacheRevision(db), () => true);
  await save('alice', 'one'); await save('bob', 'two');
  assert.deepEqual((await readCachedRecipes(db, 'alice')).map(r => r.id), ['one']);
  assert.equal((await readCachedRecipes(db, 'unknown')).length, 0);
  const old = recipeCacheRevision(db);
  await forgetCachedRecipe(db, 'alice', 'one');
  await cacheRecipe(db, 'alice', recipe('one'), old, () => true);
  assert.equal((await readCachedRecipes(db, 'alice')).length, 0, 'late fetch cannot restore deleted recipe');
  await cacheRecipe(db, 'alice', recipe('private'), recipeCacheRevision(db), () => false);
  assert.equal((await readCachedRecipes(db, 'alice')).length, 0, 'changed session cannot save');
  await save('alice', 'one'); await save('alice', 'three');
  await pruneRecipeCache(db, 'alice', ['three'], recipeCacheRevision(db), () => true);
  assert.deepEqual((await readCachedRecipes(db, 'alice')).map(r => r.id), ['three']);
  assert.equal((await readCachedRecipes(db, 'bob')).length, 1);
  await cacheRecipe(db, 'alice', { ...recipe('three'), savedAt: null }, recipeCacheRevision(db), () => true);
  assert.equal((await readCachedRecipes(db, 'alice')).length, 0, 'unsaved recipes are not retained');
  for (let index = 0; index < 105; index++) await save('alice', String(index));
  assert.equal((await readCachedRecipes(db, 'alice')).length, 100);
  sql.exec("INSERT INTO saved_recipe_snapshots VALUES ('alice', 'broken', 'not-json', 0)");
  assert.equal((await readCachedRecipes(db, 'alice')).length, 100, 'corrupt row skipped');
  const beforeSignOut = recipeCacheRevision(db);
  await clearRecipeCache(db);
  await cacheRecipe(db, 'alice', recipe('late'), beforeSignOut, () => true);
  assert.equal((await readCachedRecipes(db, 'alice')).length, 0);
  assert.equal((await readCachedRecipes(db, 'bob')).length, 0);
  sql.close();
  console.log('PASS: recipe cache SQL, account isolation, stale-session/delete guards, pruning, capacity, corrupt rows and sign-out.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

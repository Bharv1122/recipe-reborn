// Explicit opt-in only: sends the supplied owner screenshots to the configured
// recipe extraction provider. Never runs in routine CI or reads account tokens.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractRecipe } from '../lib/recipe-extraction';
import { importFile, recipePage } from '../lib/recipe-import';

async function main() {
  if (process.env.QA26_LIVE !== '1') throw new Error('Set QA26_LIVE=1 explicitly.');
  const directory = process.argv[2];
  const output = process.argv[3];
  if (!directory || !output) throw new Error('Supply screenshot directory and local result path.');
  const results = await Promise.all(['123515', '123627'].map(async time => {
    const name = `Screenshot_20261003_${time}_Gallery.jpg`;
    const bytes = await readFile(path.join(directory, name));
    const source = await importFile(new File([bytes], name, { type: 'image/jpeg' }));
    const recipe = await extractRecipe(source, new AbortController().signal, true);
    assert.match(recipe.freshIngredients, /fl(?:our|\[unclear\])/i);
    assert.match(recipe.freshIngredients, /corn/i);
    assert.match(recipe.freshIngredients, /milk/i);
    if (time === '123515') assert.equal(recipe.needsDirections, true, 'Handwritten ingredients must not acquire invented directions.');
    else {
      assert.equal(recipe.needsDirections, false); assert.match(recipe.instructions, /fry|oil/i);
      assert.match(recipe.freshIngredients, /\[unclear\]/, 'Pink annotations obscure printed amounts: mark uncertainty rather than claim exact transcription.');
      assert.ok(recipe.reviewNotes.trim(), 'Obscured text needs a visible review note.');
    }
    return { name, recipe };
  }));
  let website: { readable: boolean; length?: number; reason?: string };
  try { const text = await recipePage('https://www.allrecipes.com/recipe/18040/corn-fritters/'); website = { readable: true, length: text.length }; }
  catch (error) { website = { readable: false, reason: error instanceof Error ? error.message : 'Unknown error' }; }
  const routes = await Promise.all(['/api/import-recipe', '/api/import-recipe/adapt', '/api/generate-recipe'].map(async route => {
    const response = await fetch(`https://recipereborn.com${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const type = response.headers.get('content-type');
    assert.equal(response.status, 401); assert.match(type ?? '', /application\/json/);
    return { route, status: response.status, type };
  }));
  await writeFile(output, JSON.stringify({ testedAt: new Date().toISOString(), extraction: results, website, routes }, null, 2));
  console.log(JSON.stringify({ screenshotExtraction: results.map(({ name, recipe }) => ({ name, partial: recipe.needsDirections, ingredients: recipe.freshIngredients.split('\n').length, steps: recipe.instructions ? recipe.instructions.split('\n').length : 0 })), website, routes }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Live QA failed'); process.exitCode = 1; });

import assert from 'node:assert/strict';
import { importFile, normalizeImportedRecipe, publicIPv4, recipePage, MAX_IMPORT_FILE_BYTES } from '../lib/recipe-import';
import { RequestDeadlineError, withRequestDeadline } from '../lib/request-deadline';
import { importedRecipeLines, MISSING_SOURCE_DIRECTIONS, sourceHasDirections } from '../shared/recipe-import';
import { importedRecipeSnapshotSchema, importAdaptationRequestSchema } from '../lib/import-recipe-adaptation';

async function main() {
  for (const ip of ['127.0.0.1', '10.1.1.1', '169.254.169.254', '192.168.0.1', '172.31.0.1', '100.64.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4('8.8.8.8'), true);
  for (const url of ['http://example.com/recipe', 'file:///etc/passwd', 'https://name:secret@example.com', 'https://example.com:8443']) await assert.rejects(() => recipePage(url));
  const source = 'Soup\n1 cup water\nBoil the water.';
  assert.deepEqual(await importFile(new File([source], 'recipe.txt', { type: 'text/plain' })), { text: source });
  await assert.rejects(() => importFile(new File([''], 'empty.txt', { type: 'text/plain' })));
  await assert.rejects(() => importFile(new File(['not a jpeg'], 'fake.jpg', { type: 'image/jpeg' })));
  await assert.rejects(() => importFile(new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], 'huge.pdf', { type: 'application/pdf' })));
  await assert.rejects(() => importFile(new File([new Uint8Array([0xff, 0xfe])], 'bad.txt', { type: 'text/plain' })));
  await assert.rejects(() => importFile(new File(['x'.repeat(102401)], 'long.txt', { type: 'text/plain' })));
  const pdf = await importFile(new File(['%PDF-1.7\n'], 'recipe.pdf', { type: 'application/pdf' }));
  assert.ok('inlineData' in pdf && pdf.inlineData.mimeType === 'application/pdf');
  const recipe = normalizeImportedRecipe({ title: ' Soup ', ingredients: ['1 cup water', '1 tsp salt'], instructions: ['Boil.', 'Serve.'], dietaryTags: ['invented'] });
  assert.equal(recipe.originalIngredients, '1 cup water\n1 tsp salt');
  assert.equal(recipe.instructions, 'Boil.\nServe.');
  assert.equal(recipe.prepTime, 'Not specified');
  assert.deepEqual(recipe.dietaryTags, []);
  const webSnapshot = {
    title: recipe.title, freshIngredients: importedRecipeLines(recipe.freshIngredients),
    instructions: importedRecipeLines(recipe.instructions), prepTime: recipe.prepTime,
    cookTime: recipe.cookTime, servings: recipe.servings, dietaryTags: recipe.dietaryTags,
  };
  assert.equal(webSnapshot.freshIngredients[0], '1 cup water', 'Web ingredient selection must select a line, not a character.');
  assert.equal(importedRecipeSnapshotSchema.safeParse(webSnapshot).success, true, 'An imported web snapshot must be saveable.');
  assert.equal(importAdaptationRequestSchema.safeParse({ recipe: webSnapshot, action: { type: 'remove', original: webSnapshot.freshIngredients[1] } }).success, true, 'The web import must be adaptable.');
  assert.equal(normalizeImportedRecipe({ title: 'Soup', ingredients: ['water'], instructions: ['Boil'], reviewNotes: ['Line 2 is unclear'] }).reviewNotes, 'Line 2 is unclear');
  assert.throws(() => normalizeImportedRecipe({ title: 'Soup', ingredients: [] }));
  const untitled = normalizeImportedRecipe({ ingredients: ['1 cup flour'], instructions: ['Mix with water.'] });
  assert.equal(untitled.title, 'Imported recipe');
  assert.match(untitled.reviewNotes, /title/i);
  assert.equal(untitled.instructions, 'Mix with water.');
  const partial = normalizeImportedRecipe({ title: 'Corn fritters', ingredients: ['1 cup flour', '1 egg'], instructions: [] }, true);
  assert.equal(partial.needsDirections, true);
  assert.equal(partial.instructions, '', 'An ingredient-only source must not acquire invented directions.');
  assert.equal(sourceHasDirections([MISSING_SOURCE_DIRECTIONS]), false, 'A partial source cannot overwrite user-added directions on restore.');
  assert.equal(sourceHasDirections(['Mix and fry.']), true);
  assert.equal(partial.freshIngredients, '1 cup flour\n1 egg');
  assert.throws(() => normalizeImportedRecipe({ title: 'Corn fritters', ingredients: ['1 cup flour'] }), /directions/i, 'Older clients must not receive an unusable partial recipe.');
  assert.throws(() => normalizeImportedRecipe({ instructions: ['Fry.'] }, true), /ingredient/i);
  assert.throws(() => normalizeImportedRecipe({ title: 'Soup', ingredients: ['x'.repeat(501)], instructions: ['Boil.'] }), /supported length/);
  assert.throws(() => normalizeImportedRecipe({ title: 'Soup', ingredients: ['water'], instructions: ['x'.repeat(3001)] }), /supported length/);
  assert.throws(() => normalizeImportedRecipe({ title: 'Soup', ingredients: ['water'], instructions: ['Boil'], prepTime: 'x'.repeat(101) }), /supported length/);
  let providerSignal: AbortSignal | undefined;
  await assert.rejects(withRequestDeadline(new AbortController().signal, 20, async signal => {
    providerSignal = signal;
    // Headers have arrived, but the body never finishes. The whole operation
    // must still time out, even if a transport ignores cancellation.
    await Promise.resolve();
    return new Promise<never>(() => {});
  }), RequestDeadlineError);
  assert.equal(providerSignal?.aborted, true);
  const canceled = new AbortController();
  let called = false;
  canceled.abort();
  await assert.rejects(withRequestDeadline(canceled.signal, 100, async () => { called = true; }), { name: 'AbortError' });
  assert.equal(called, false, 'A canceled request must not start a provider call.');
  const during = new AbortController();
  const pending = withRequestDeadline(during.signal, 100, async () => new Promise<never>(() => {}));
  during.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(await withRequestDeadline(new AbortController().signal, 100, async () => 'complete'), 'complete');
  await assert.rejects(recipePage('https://example.com', 0, canceled.signal), { name: 'AbortError' });
  const route = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../app/api/import-recipe/route.ts', import.meta.url), 'utf8'));
  assert.match(route, /getRequestUserId/);
  assert.match(route, /req\.formData\(\)/);
  assert.match(route, /extractRecipe/);
  assert.match(route, /findBlockedFoodInRecipe/);
  assert.match(route, /import was kept faithful and was not rewritten/);
  assert.doesNotMatch(route, /prisma\.recipe\.create/, 'Import extraction must not auto-save a recipe.');
  console.log('Recipe import validation checks passed. No external AI requests made.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

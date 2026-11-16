import assert from 'node:assert/strict';
import { importFile, normalizeImportedRecipe, publicIPv4, recipePage, MAX_IMPORT_FILE_BYTES } from '../lib/recipe-import';

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
  assert.equal(normalizeImportedRecipe({ title: 'Soup', ingredients: ['water'], instructions: ['Boil'], reviewNotes: ['Line 2 is unclear'] }).reviewNotes, 'Line 2 is unclear');
  assert.throws(() => normalizeImportedRecipe({ title: 'Soup', ingredients: [] }));
  const route = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../app/api/import-recipe/route.ts', import.meta.url), 'utf8'));
  assert.match(route, /getRequestUserId/);
  assert.match(route, /req\.formData\(\)/);
  assert.match(route, /AI_GENERATE_URL/);
  assert.match(route, /findBlockedFoodInRecipe/);
  assert.match(route, /import was kept faithful and was not rewritten/);
  assert.doesNotMatch(route, /prisma\.recipe\.create/, 'Import extraction must not auto-save a recipe.');
  console.log('Recipe import validation checks passed. No external AI requests made.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

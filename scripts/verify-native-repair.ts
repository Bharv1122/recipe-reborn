import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseShoppingItems } from '../mobile/src/services/shopping-input';
import { isValidMealPlanDate, splitPreferenceList } from '../mobile/src/services/meal-plan-input';
import { stageScanRecipeHandoff, takeScanRecipeHandoff } from '../mobile/src/services/scan-recipe-handoff';

async function main() {
  assert.deepEqual(parseShoppingItems('milk'), ['milk']);
  assert.deepEqual(parseShoppingItems(' milk, eggs\n bread,\r\n  '), ['milk', 'eggs', 'bread']);
  assert.deepEqual(parseShoppingItems('apples, apples'), ['apples', 'apples'], 'Existing duplicate-item behavior must be preserved.');
  assert.deepEqual(splitPreferenceList('shellfish, peanuts\nfish'), ['shellfish', 'peanuts', 'fish']);
  assert.equal(isValidMealPlanDate('2026-08-24'), true);
  assert.equal(isValidMealPlanDate('2026-02-31'), false);
  assert.equal(isValidMealPlanDate('08/24/2026'), false);
  stageScanRecipeHandoff({ source: 'label', origin: 'barcode', ingredients: ' sugar, water ', context: ' Test product ' });
  assert.deepEqual(takeScanRecipeHandoff(), { source: 'label', origin: 'barcode', ingredients: 'sugar, water', context: 'Test product' });
  assert.equal(takeScanRecipeHandoff(), null, 'A scan handoff must be consumed only once.');
  assert.throws(() => stageScanRecipeHandoff({ source: 'label', origin: 'label-photo', ingredients: '  ', context: 'Label' }));

  const [config, mealScreen, mealRoute, generatorScreen, generatorRoute, shoppingRoute, scanScreen, labelRoute] = await Promise.all([
    readFile('mobile/app.config.ts', 'utf8'),
    readFile('mobile/src/app/meal-plans/index.tsx', 'utf8'),
    readFile('app/api/meal-plans/generate/route.ts', 'utf8'),
    readFile('mobile/src/app/generate.tsx', 'utf8'),
    readFile('app/api/generate-recipe/route.ts', 'utf8'),
    readFile('app/api/mobile/shopping-lists/[id]/items/route.ts', 'utf8'),
    readFile('mobile/src/app/(tabs)/scan.tsx', 'utf8'),
    readFile('app/api/extract-recipe-from-photo/route.ts', 'utf8'),
  ]);

  assert.doesNotMatch(config, /cameraPermission:\s*false/, 'No plugin may block Android CAMERA.');
  assert.match(config, /cameraPermission:\s*'Scan food labels and barcodes/);
  for (const control of ['weekStartDate', 'selectedMealTypes', 'servings', 'calorieTarget', 'allergies', 'dislikes', 'selectedDietary']) {
    assert.match(mealScreen, new RegExp(control), `Missing meal-plan control: ${control}`);
  }
  assert.match(mealScreen, /api\/meal-plans\/generate/);
  assert.match(mealRoute, /getRequestUserId\(req\)/, 'Meal generation must accept the existing secure native bearer token.');
  assert.match(generatorScreen, /label="Specific dish"/);
  assert.match(generatorScreen, /label="Random"/);
  assert.match(generatorRoute, /source === 'dish'/);
  assert.match(generatorRoute, /source === 'random'/);
  assert.match(shoppingRoute, /bulkItemSchema/);
  assert.match(shoppingRoute, /prisma\.\$transaction/);
  assert.match(scanScreen, /label="Generate recipe"/);
  assert.match(scanScreen, /label="Scan another" secondary/);
  assert.match(scanScreen, /Extract and review ingredients/);
  assert.match(scanScreen, /stageScanRecipeHandoff/);
  assert.match(generatorScreen, /takeScanRecipeHandoff/);
  assert.match(generatorScreen, /Review the scanned ingredients/);
  assert.match(labelRoute, /getRequestUserId\(req\)/, 'Label extraction must accept the secure native bearer token.');

  assert.match(config, /icon:\s*'\.\/assets\/images\/recipe-reborn-icon\.png'/);
  assert.match(config, /foregroundImage:\s*'\.\/assets\/images\/recipe-reborn-android-foreground\.png'/);
  assert.match(config, /monochromeImage:\s*'\.\/assets\/images\/recipe-reborn-android-monochrome\.png'/);
  assert.doesNotMatch(config, /assets\/images\/(?:icon|android-icon-(?:foreground|monochrome))\.png/);

  const iconFiles = await Promise.all([
    readFile('mobile/assets/images/recipe-reborn-icon-source.png'),
    readFile('mobile/assets/images/recipe-reborn-icon.png'),
    readFile('mobile/assets/images/recipe-reborn-android-foreground.png'),
    readFile('mobile/assets/images/recipe-reborn-android-monochrome.png'),
    readFile('outputs/store-assets/recipe-reborn-google-play-icon-512.png'),
  ]);
  const pngSize = (file: Buffer) => {
    assert.equal(file.subarray(1, 4).toString('ascii'), 'PNG', 'Brand assets must be PNG files.');
    return [file.readUInt32BE(16), file.readUInt32BE(20)];
  };
  assert.deepEqual(pngSize(iconFiles[0]), [1024, 1024]);
  assert.deepEqual(pngSize(iconFiles[1]), [1024, 1024]);
  assert.deepEqual(pngSize(iconFiles[2]), [1024, 1024]);
  assert.deepEqual(pngSize(iconFiles[3]), [432, 432]);
  assert.deepEqual(pngSize(iconFiles[4]), [512, 512]);

  console.log('Native repair verification passed: camera config, scan-to-generator review, weekly-plan parity, bulk shopping parsing, protected dish/random entry points, and native/store icon assets.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

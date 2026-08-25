import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseShoppingItems } from '../mobile/src/services/shopping-input';
import { isValidMealPlanDate, splitPreferenceList } from '../mobile/src/services/meal-plan-input';

async function main() {
  assert.deepEqual(parseShoppingItems('milk'), ['milk']);
  assert.deepEqual(parseShoppingItems(' milk, eggs\n bread,\r\n  '), ['milk', 'eggs', 'bread']);
  assert.deepEqual(parseShoppingItems('apples, apples'), ['apples', 'apples'], 'Existing duplicate-item behavior must be preserved.');
  assert.deepEqual(splitPreferenceList('shellfish, peanuts\nfish'), ['shellfish', 'peanuts', 'fish']);
  assert.equal(isValidMealPlanDate('2026-08-24'), true);
  assert.equal(isValidMealPlanDate('2026-02-31'), false);
  assert.equal(isValidMealPlanDate('08/24/2026'), false);

  const [config, mealScreen, mealRoute, generatorScreen, generatorRoute, shoppingRoute] = await Promise.all([
    readFile('mobile/app.config.ts', 'utf8'),
    readFile('mobile/src/app/meal-plans/index.tsx', 'utf8'),
    readFile('app/api/meal-plans/generate/route.ts', 'utf8'),
    readFile('mobile/src/app/generate.tsx', 'utf8'),
    readFile('app/api/generate-recipe/route.ts', 'utf8'),
    readFile('app/api/mobile/shopping-lists/[id]/items/route.ts', 'utf8'),
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

  console.log('Native repair verification passed: camera config, weekly-plan parity, bulk shopping parsing, and protected dish/random entry points.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

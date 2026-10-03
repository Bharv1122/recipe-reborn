import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { READ_PAGE_RECIPE, recipeBrowserUrl, sameRecipeWebsite } from '../shared/recipe-browser';

const url = 'https://www.allrecipes.com/recipe/18040/corn-fritters/?print=';
assert.equal(recipeBrowserUrl(url), url);
for (const unsafe of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'file:///etc/passwd', 'https://host.local', 'https://user:secret@example.com', 'https://example.com:8443']) assert.throws(() => recipeBrowserUrl(unsafe));
assert.equal(sameRecipeWebsite(url + '#recipe', url), true);
assert.equal(sameRecipeWebsite('https://allrecipes.com/recipe/18040/corn-fritters/', url), true);
assert.equal(sameRecipeWebsite('https://evil.example.org', url), false);
assert.equal(sameRecipeWebsite('intent://other-app', url), false);
const recipe = { '@type': ['Recipe'], name: 'Test corn fritters', recipeIngredient: ['1 cup corn', '1 egg'], recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Mix corn and egg.' }, { text: 'Cook until set.' }] }], recipeYield: ['2', '2 servings'], prepTime: 'PT5M', cookTime: 'PT10M' };
function read(values: unknown[]) {
  const messages: { text?: string; error?: string }[] = [];
  runInNewContext(READ_PAGE_RECIPE, {
    document: { querySelectorAll: (selector: string) => { assert.equal(selector, 'script[type="application/ld+json"]'); return values.map(value => ({ textContent: JSON.stringify(value) })); }, createElement: (tag: string) => { assert.equal(tag, 'textarea'); return { innerHTML: '', get value() { return this.innerHTML.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&frac12;/g, '½'); } }; } },
    location: { href: url }, window: { ReactNativeWebView: { postMessage: (value: string) => messages.push(JSON.parse(value)) } },
  }, { timeout: 1000 });
  assert.equal(messages.length, 1);
  return messages[0];
}
const found = read([{ '@graph': [recipe] }]);
assert.match(found.text!, /Ingredients\n1 cup corn\n1 egg/);
assert.match(found.text!, /Directions\nMix corn and egg.\nCook until set./);
assert.match(found.text!, /Servings\/yield: 2\n/);
assert.match(found.text!, /Prep time: 5 min/);
assert.match(read([{ ...recipe, cookTime: 'PT1H15M', recipeYield: ['four portions', '4 servings'], recipeIngredient: ['1&frac12; cups baker&#39;s flour &amp; water'] }]).text!, /Cook time: 1 hr 15 min\nIngredients\n1½ cups baker's flour & water/);
assert.match(found.text!, /Source: https:\/\/www.allrecipes.com/);
assert.ok(read([{ '@type': 'Article', name: 'Not a recipe' }]).error);
assert.ok(read([recipe, recipe]).error, 'Never merge multiple page recipes.');
assert.ok(read([{ ...recipe, recipeInstructions: [] }]).error, 'Never invent missing steps.');
assert.ok(read([{ ...recipe, recipeIngredient: ['a'.repeat(110000)] }]).error);
console.log('Website recipe extraction, provenance, missing-data and navigation-boundary checks passed.');

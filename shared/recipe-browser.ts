export function recipeBrowserUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
    /(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(url.hostname)) {
    throw new Error('Use a public HTTPS recipe website.');
  }
  return url.href;
}

export function sameRecipeWebsite(raw: string, initial: string): boolean {
  try { return new URL(recipeBrowserUrl(raw)).hostname.replace(/^www\./, '') === new URL(recipeBrowserUrl(initial)).hostname.replace(/^www\./, ''); }
  catch { return false; }
}

// Only run after the user presses Use page recipe. Read Recipe metadata from
// the open document, never cookies, storage, form fields or browsing history.
export const READ_PAGE_RECIPE = String.raw`
(function () {
  var send = function (value) { window.ReactNativeWebView.postMessage(JSON.stringify(value)); };
  try {
    var recipes = [], visited = 0;
    var walk = function (value, depth) {
      if (!value || typeof value !== 'object' || depth > 8 || ++visited > 2000) return;
      if (Array.isArray(value)) { value.forEach(function (item) { walk(item, depth + 1); }); return; }
      var types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      if (types.indexOf('Recipe') >= 0) { recipes.push(value); return; }
      Object.keys(value).forEach(function (key) { walk(value[key], depth + 1); });
    };
    Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'), 0, 20).forEach(function (node) {
      if (node.textContent.length > 300000) return;
      try { walk(JSON.parse(node.textContent), 0); } catch (_) {}
    });
    if (recipes.length !== 1) { send({ error: 'This page does not expose one clear recipe. Copy its ingredients and directions into Text, or use a screenshot.' }); return; }
    var recipe = recipes[0];
    var clean = function (value) {
      if (typeof value !== 'string') return '';
      var decoded = document.createElement('textarea');
      decoded.innerHTML = value;
      return decoded.value.replace(/<[^>]*>/g, ' ').trim();
    };
    var steps = [], count = 0;
    var readSteps = function (value, depth) {
      if (!value || depth > 8 || ++count > 1000) return;
      if (typeof value === 'string') { if (clean(value)) steps.push(clean(value)); }
      else if (Array.isArray(value)) value.forEach(function (item) { readSteps(item, depth + 1); });
      else if (value.itemListElement) readSteps(value.itemListElement, depth + 1);
      else if (value.text) readSteps(value.text, depth + 1);
    };
    readSteps(recipe.recipeInstructions, 0);
    var ingredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient.map(clean).filter(Boolean) : [];
    if (!ingredients.length || !steps.length) { send({ error: 'The page recipe is missing ingredients or directions. Use Text or a screenshot to review the source.' }); return; }
    var yieldValues = (Array.isArray(recipe.recipeYield) ? recipe.recipeYield : [recipe.recipeYield]).map(function (value) { return clean(String(value || '')); });
    var yields = yieldValues.find(function (value) { return /^\d+(?:\s+servings?)?$/i.test(value); }) || yieldValues[0] || 'Not specified';
    yields = yields.replace(/\s+servings?$/i, '');
    var time = function (value) {
      var text = clean(value), match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(text);
      return match ? [match[1] && match[1] + ' hr', match[2] && match[2] + ' min', match[3] && match[3] + ' sec'].filter(Boolean).join(' ') : text;
    };
    var text = [clean(recipe.name) || 'Imported recipe', 'Source: ' + location.href,
      'Servings/yield: ' + yields, 'Prep time: ' + time(recipe.prepTime), 'Cook time: ' + time(recipe.cookTime),
      'Ingredients', ingredients.join('\n'), 'Directions', steps.join('\n')].join('\n');
    if (text.length > 100000) { send({ error: 'This recipe is too long. Copy a shorter recipe into Text.' }); return; }
    send({ text: text });
  } catch (_) { send({ error: 'The recipe could not be read from this page. Use Text or a screenshot.' }); }
})(); true;
`;

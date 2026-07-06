// The "yuck list" — common additives, preservatives, and ultra-processing
// markers found on packaged-food labels. Used to make the transformation
// visible: count and name what a fresh homemade version leaves behind.
//
// Matching is case-insensitive substring against the raw ingredient text.
// Entries are ordered so more specific phrases win when we de-duplicate
// (e.g. "high fructose corn syrup" before "corn syrup").

export type AdditiveCategory =
  | 'Preservative'
  | 'Flavor enhancer'
  | 'Artificial color'
  | 'Added sweetener'
  | 'Emulsifier / texture'
  | 'Processing aid';

export interface Additive {
  name: string; // display name
  category: AdditiveCategory;
  concern: string; // one-line, plain-English "why care"
  match: string[]; // lowercase substrings that indicate its presence
}

const ADDITIVES: Additive[] = [
  // Preservatives
  { name: 'Sodium nitrite', category: 'Preservative', concern: 'Curing agent linked to processed-meat health concerns', match: ['sodium nitrite'] },
  { name: 'Sodium nitrate', category: 'Preservative', concern: 'Curing preservative', match: ['sodium nitrate'] },
  { name: 'BHT', category: 'Preservative', concern: 'Synthetic antioxidant preservative', match: ['bht', 'butylated hydroxytoluene'] },
  { name: 'BHA', category: 'Preservative', concern: 'Synthetic antioxidant preservative', match: ['bha', 'butylated hydroxyanisole'] },
  { name: 'TBHQ', category: 'Preservative', concern: 'Petroleum-derived preservative', match: ['tbhq', 'tertiary butylhydroquinone'] },
  { name: 'Sodium benzoate', category: 'Preservative', concern: 'Synthetic preservative', match: ['sodium benzoate'] },
  { name: 'Potassium sorbate', category: 'Preservative', concern: 'Synthetic preservative', match: ['potassium sorbate'] },
  { name: 'Calcium propionate', category: 'Preservative', concern: 'Mold-inhibiting preservative', match: ['calcium propionate'] },
  { name: 'Sodium erythorbate', category: 'Preservative', concern: 'Curing preservative', match: ['sodium erythorbate'] },
  { name: 'EDTA', category: 'Preservative', concern: 'Synthetic preservative / stabilizer', match: ['edta'] },
  { name: 'Sulfur dioxide', category: 'Preservative', concern: 'Preservative that can trigger sensitivities', match: ['sulfur dioxide', 'sulphur dioxide', 'sodium sulfite', 'sodium metabisulfite'] },

  // Flavor enhancers
  { name: 'MSG', category: 'Flavor enhancer', concern: 'Synthetic flavor enhancer', match: ['monosodium glutamate', 'msg'] },
  { name: 'Disodium inosinate', category: 'Flavor enhancer', concern: 'Flavor enhancer, usually paired with MSG', match: ['disodium inosinate'] },
  { name: 'Disodium guanylate', category: 'Flavor enhancer', concern: 'Flavor enhancer, usually paired with MSG', match: ['disodium guanylate'] },
  { name: 'Yeast extract', category: 'Flavor enhancer', concern: 'Hidden source of free glutamates', match: ['yeast extract', 'autolyzed yeast'] },
  { name: 'Hydrolyzed protein', category: 'Flavor enhancer', concern: 'Processed protein used as a flavor booster', match: ['hydrolyzed'] },
  { name: 'Artificial flavor', category: 'Flavor enhancer', concern: 'Lab-made flavoring', match: ['artificial flavor', 'artificial flavour'] },

  // Artificial colors
  { name: 'Red 40', category: 'Artificial color', concern: 'Synthetic dye', match: ['red 40', 'red no. 40', 'allura red'] },
  { name: 'Yellow 5', category: 'Artificial color', concern: 'Synthetic dye', match: ['yellow 5', 'yellow no. 5', 'tartrazine'] },
  { name: 'Yellow 6', category: 'Artificial color', concern: 'Synthetic dye', match: ['yellow 6', 'yellow no. 6', 'sunset yellow'] },
  { name: 'Blue 1', category: 'Artificial color', concern: 'Synthetic dye', match: ['blue 1', 'blue no. 1', 'brilliant blue'] },
  { name: 'Blue 2', category: 'Artificial color', concern: 'Synthetic dye', match: ['blue 2', 'blue no. 2', 'indigotine'] },
  { name: 'Caramel color', category: 'Artificial color', concern: 'Processed coloring', match: ['caramel color', 'caramel colour'] },
  { name: 'Titanium dioxide', category: 'Artificial color', concern: 'Whitening agent banned in the EU', match: ['titanium dioxide'] },
  { name: 'Artificial color', category: 'Artificial color', concern: 'Synthetic dye', match: ['artificial color', 'artificial colour', 'fd&c'] },

  // Added sweeteners
  { name: 'High-fructose corn syrup', category: 'Added sweetener', concern: 'Ultra-processed sweetener', match: ['high fructose corn syrup', 'high-fructose corn syrup'] },
  { name: 'Corn syrup', category: 'Added sweetener', concern: 'Refined added sugar', match: ['corn syrup'] },
  { name: 'Aspartame', category: 'Added sweetener', concern: 'Artificial sweetener', match: ['aspartame'] },
  { name: 'Sucralose', category: 'Added sweetener', concern: 'Artificial sweetener', match: ['sucralose'] },
  { name: 'Acesulfame potassium', category: 'Added sweetener', concern: 'Artificial sweetener', match: ['acesulfame'] },
  { name: 'Dextrose', category: 'Added sweetener', concern: 'Refined added sugar', match: ['dextrose'] },
  { name: 'Maltodextrin', category: 'Added sweetener', concern: 'Highly processed carbohydrate', match: ['maltodextrin'] },

  // Emulsifiers / texture
  { name: 'Mono- and diglycerides', category: 'Emulsifier / texture', concern: 'Processed fat emulsifier', match: ['diglycerides', 'monoglycerides', 'mono- and diglycerides'] },
  { name: 'Carrageenan', category: 'Emulsifier / texture', concern: 'Thickener linked to digestive concerns', match: ['carrageenan'] },
  { name: 'Xanthan gum', category: 'Emulsifier / texture', concern: 'Processed thickener', match: ['xanthan gum'] },
  { name: 'Guar gum', category: 'Emulsifier / texture', concern: 'Processed thickener', match: ['guar gum'] },
  { name: 'Soy lecithin', category: 'Emulsifier / texture', concern: 'Processed emulsifier', match: ['soy lecithin', 'soya lecithin'] },
  { name: 'Cellulose gum', category: 'Emulsifier / texture', concern: 'Processed thickener', match: ['cellulose gum', 'carboxymethylcellulose'] },
  { name: 'Modified food starch', category: 'Emulsifier / texture', concern: 'Chemically altered starch', match: ['modified food starch', 'modified corn starch', 'modified starch'] },

  // Processing aids
  { name: 'Partially hydrogenated oil', category: 'Processing aid', concern: 'Source of artificial trans fat', match: ['partially hydrogenated'] },
  { name: 'Palm oil', category: 'Processing aid', concern: 'Highly refined oil', match: ['palm oil'] },
  { name: 'Sodium phosphate', category: 'Processing aid', concern: 'Processed mineral additive', match: ['sodium phosphate', 'sodium tripolyphosphate'] },
  { name: 'Sodium citrate', category: 'Processing aid', concern: 'Processed emulsifying salt', match: ['sodium citrate'] },
];

export interface DetectedAdditive {
  name: string;
  category: AdditiveCategory;
  concern: string;
}

// Detect known additives in a raw ingredient string. Returns each additive
// at most once, in the order defined above (roughly severity-grouped).
export function detectAdditives(text: string | null | undefined): DetectedAdditive[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  const found: DetectedAdditive[] = [];
  const seen = new Set<string>();
  for (const a of ADDITIVES) {
    if (seen.has(a.name)) continue;
    if (a.match.some((m) => haystack.includes(m))) {
      found.push({ name: a.name, category: a.category, concern: a.concern });
      seen.add(a.name);
    }
  }
  return found;
}

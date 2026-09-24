import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST, MODEL_SMART } from './ai';
import {
  DAYS, expandBlockedIngredients, parseMealPlanContent, validateMealPlan,
  type DayName, type MealPlanValidationError, type MealType, type ValidatedDayPlan,
} from './meal-plan-validation';

export interface GeneratePlanOptions {
  weekStartDate: string;
  dietaryPreferences: string[];
  calorieTarget?: number;
  mealTypes: MealType[];
  servings: number;
  allergies: string[];
  dislikedIngredients: string[];
}

const mealJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'string' },
    prepTime: { type: 'string' },
    cookTime: { type: 'string' },
    servings: { type: 'integer' },
    dietaryTags: { type: 'array', items: { type: 'string' } },
    estimatedCalories: { type: 'integer' },
  },
  required: ['title', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servings', 'dietaryTags', 'estimatedCalories'],
  additionalProperties: false,
};

function structuredFormat(name: string, schema: Record<string, unknown>) {
  return { type: 'json_schema', json_schema: { name, strict: true, schema } };
}

function blockedIngredientInstruction(options: GeneratePlanOptions): string {
  const terms = expandBlockedIngredients([...options.allergies, ...options.dislikedIngredients]);
  return terms.length ? `Validation also excludes these ingredient names and aliases: ${terms.join(', ')}. Use alternatives; do not include these names in recipe titles, ingredients, or instructions, even as a negation or optional suggestion.` : '';
}

export class MealPlanSafetyError extends Error {
  constructor() {
    super('The generated meal plan failed safety validation twice.');
    this.name = 'MealPlanSafetyError';
  }
}

export class MealPlanProviderError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = 'MealPlanProviderError';
  }
}

// Never log provider bodies: they can contain the user's food preferences.
async function requestContent(body: Record<string, unknown>): Promise<string> {
  let response: Response;
  try {
    response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ ...body, reasoning_effort: 'none' }),
    });
  } catch {
    throw new MealPlanProviderError('Meal-plan provider request timed out or failed to connect');
  }
  if (!response.ok) {
    throw new MealPlanProviderError(
      `Meal-plan provider returned status ${response.status}`,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new MealPlanProviderError('Meal-plan provider returned an invalid response');
  }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new MealPlanProviderError('Meal-plan provider response was truncated');
  }
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new MealPlanProviderError('Meal-plan provider returned no content');
  }
  return content;
}

function buildPrompt(options: GeneratePlanOptions): string {
  const dietaryInfo = options.dietaryPreferences.length > 0
    ? `Dietary preferences: ${options.dietaryPreferences.join(', ')}`
    : 'No specific dietary restrictions';
  const calorieInfo = options.calorieTarget
    ? `Target daily calories across the selected meals: ${options.calorieTarget}`
    : 'No specific calorie target';
  const allergyInfo = options.allergies.length > 0
    ? `FOOD ALLERGIES: ${options.allergies.join(', ')}. Never include these allergens, their derivatives, sauces, stocks, seasonings, or cross-named ingredients. Do not mention an allergen even in a "free-from" ingredient label; choose an unambiguous alternative instead.`
    : 'No food allergies were supplied';
  const dislikeInfo = options.dislikedIngredients.length > 0
    ? `Disliked ingredients: ${options.dislikedIngredients.join(', ')}. Avoid them and use alternatives.`
    : 'No disliked ingredients were supplied';
  const mealKeys = options.mealTypes.join(', ');
  const mealTemplate = options.mealTypes.map((mealType) => `
    "${mealType}": {
      "title": "Recipe name",
      "ingredients": ["measured ingredient 1", "measured ingredient 2"],
      "instructions": "Concise step-by-step instructions",
      "prepTime": "10 min",
      "cookTime": "20 min",
      "servings": ${options.servings},
      "dietaryTags": ["tag"],
      "estimatedCalories": 450
    }`).join(',');

  return `Create one practical seven-day meal plan.

Requirements:
- Week starting: ${new Date(options.weekStartDate).toLocaleDateString()}
- ${dietaryInfo}
- ${calorieInfo}
- Exact meal types for every day: ${mealKeys}
- Exactly ${options.mealTypes.length} meals per day and ${DAYS.length * options.mealTypes.length} meals total
- Exactly ${options.servings} serving${options.servings === 1 ? '' : 's'} per recipe
- ${allergyInfo}
- ${dislikeInfo}
- ${blockedIngredientInstruction(options)}
- Use varied, achievable home-cooking recipes with measured ingredient quantities
- Every recipe must be distinct across the week. Never repeat the same dish on multiple days or disguise a repeated dish with a minor title change. Vary the main ingredient, preparation, and accompaniments.
- Build every dish from basic grocery ingredients. Ordinary staples such as plain bread or tortillas, canned beans or tomatoes, broth, condiments, and plain frozen fruit or vegetables are allowed.
- Never use a ready-to-eat or pre-cooked entree or prepared meal component, including rotisserie meat, frozen prepared meals or sides, jarred prepared gravy or pasta sauce, boxed mixes, or ready-made dough. Make those components from basic ingredients instead.
- Keep instructions concise but complete to reduce waiting time

Return only a valid JSON array with exactly seven objects, Monday through Sunday. Each day must contain "day" plus exactly these meal keys: ${mealKeys}. Never add breakfast, lunch, dinner, or snack unless it is in that exact list.

[
  {
    "day": "monday",${mealTemplate}
  }
]

Repeat that exact structure for all seven days. Do not include markdown or prose.`;
}

async function requestMealPlan(
  prompt: string,
  maxTokens: number,
  mealTypes: MealType[],
  model = MODEL_FAST,
): Promise<string> {
  return requestContent({
      model,
      messages: [
        {
          role: 'system',
          content: 'Return only valid JSON. Follow meal counts, servings, and allergy exclusions exactly.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      max_tokens: Math.min(12000, Math.max(5000, maxTokens)),
      response_format: structuredFormat('weekly_meal_plan', {
        // Keep the provider schema compact; exact day/meal counts and food
        // exclusions remain enforced by our independent validator below.
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string', enum: [...DAYS] },
            ...Object.fromEntries(mealTypes.map(type => [type, mealJsonSchema])),
          },
          required: ['day', ...mealTypes], additionalProperties: false,
        },
      }),
  });
}

function parseMealObject(content: string): unknown {
  let jsonText = content.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  jsonText = fenceMatch ? fenceMatch[1] : jsonText.replace(/^```(?:json)?\s*/, '');
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end > start) jsonText = jsonText.slice(start, end + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch {
    throw new MealPlanProviderError('Meal repair returned malformed JSON');
  }
  return parsed && typeof parsed === 'object' && 'meal' in parsed ? parsed.meal : parsed;
}

async function requestReplacementMeal(
  options: GeneratePlanOptions,
  day: DayName,
  mealType: MealType,
  model: string,
  excludedTitles: string[],
): Promise<unknown> {
  const allergies = options.allergies.length > 0
    ? `Blocked food allergies: ${options.allergies.join(', ')}. Never use them, their derivatives, sauces, stocks, or seasonings. Do not mention a blocked allergen even in a free-from label.`
    : 'No food allergies were supplied.';
  const dislikes = options.dislikedIngredients.length > 0
    ? `Avoid these disliked ingredients: ${options.dislikedIngredients.join(', ')}.`
    : '';
  const prompt = `Replace one rejected meal-plan entry with a safe home-cooking recipe.

Day: ${day}
Meal type: ${mealType}
Exact servings: ${options.servings}
${allergies}
${dislikes}
${blockedIngredientInstruction(options)}
Dietary preferences: ${options.dietaryPreferences.join(', ') || 'none'}.
Build the recipe from basic grocery ingredients. Do not use ready-to-eat or pre-cooked entrees or prepared meal components such as rotisserie meat, frozen prepared meals or sides, jarred prepared gravy or pasta sauce, boxed mixes, or ready-made dough. Ordinary staples such as plain bread or tortillas, canned beans or tomatoes, broth, condiments, and plain frozen fruit or vegetables are allowed.
Create a genuinely different dish from every other meal already in this weekly plan. Do not reuse or lightly rename any of these recipe titles: ${excludedTitles.length > 0 ? excludedTitles.join('; ') : 'none'}.

Return only one JSON object in this exact shape:
{
  "title": "Recipe name",
  "ingredients": ["measured ingredient 1", "measured ingredient 2"],
  "instructions": "Concise complete instructions",
  "prepTime": "10 min",
  "cookTime": "20 min",
  "servings": ${options.servings},
  "dietaryTags": ["tag"],
  "estimatedCalories": 450
}`;

  const content = await requestContent({
      model,
      messages: [
        { role: 'system', content: 'Return one valid JSON meal object that obeys every allergy, serving, and from-basic-ingredients constraint.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: structuredFormat('replacement_meal', mealJsonSchema),
  });
  return parseMealObject(content);
}

async function repairInvalidMeals(
  value: unknown,
  errors: MealPlanValidationError[],
  options: GeneratePlanOptions,
  model: string,
): Promise<unknown | null> {
  if (!Array.isArray(value)) return null;
  const repairableCodes = new Set(['missing_meal', 'unexpected_meal', 'invalid_meal', 'serving_mismatch', 'allergen_detected', 'disliked_ingredient', 'prepared_shortcut', 'duplicate_meal']);
  if (errors.some((error) => !repairableCodes.has(error.code) || !error.day || !error.mealType)) {
    return null;
  }

  const repaired = structuredClone(value) as Array<Record<string, unknown>>;
  for (const error of errors) {
    if (error.code !== 'unexpected_meal') continue;
    const day = repaired.find((entry) => String(entry?.day).trim().toLowerCase() === error.day);
    if (day) delete day[error.mealType!];
  }

  const slots = Array.from(new Map(
    errors
      .filter((error) => error.code !== 'unexpected_meal')
      .map((error) => [`${error.day}:${error.mealType}`, { day: error.day!, mealType: error.mealType! }])
  ).values());
  const titlesBySlot = new Map<string, string>();
  for (const rawDay of repaired) {
    const rawDayName = String(rawDay?.day).trim().toLowerCase();
    for (const candidateType of options.mealTypes) {
      const candidate = rawDay?.[candidateType];
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const title = (candidate as Record<string, unknown>).title;
      if (typeof title === 'string' && title.trim()) {
        titlesBySlot.set(`${rawDayName}:${candidateType}`, title.trim());
      }
    }
  }
  // Keep successful replacements even if another response is empty/malformed.
  // The unchanged invalid slot is retried by the next model, then the entire
  // plan is validated again before anything can be saved.
  // Duplicate repairs must see each other's new titles. Concurrent requests
  // given the same exclusions can otherwise choose the same replacement.
  const concurrency = errors.some(error => error.code === 'duplicate_meal') ? 1 : 4;
  for (let offset = 0; offset < slots.length; offset += concurrency) {
    await Promise.all(slots.slice(offset, offset + concurrency).map(async (slot) => {
      const day = repaired.find((entry) => String(entry?.day).trim().toLowerCase() === slot.day);
      if (!day) return;
      try {
        const meal = await requestReplacementMeal(
        options,
        slot.day,
        slot.mealType,
        model,
        Array.from(titlesBySlot.entries())
          .filter(([key]) => key !== `${slot.day}:${slot.mealType}`)
          .map(([, title]) => title),
        );
        day[slot.mealType] = meal;
        if (meal && typeof meal === 'object' && 'title' in meal && typeof meal.title === 'string') {
          titlesBySlot.set(`${slot.day}:${slot.mealType}`, meal.title);
        }
      } catch (error) {
        if (!(error instanceof MealPlanProviderError) || !error.retryable) throw error;
      }
    }));
  }

  return repaired;
}

export async function generateValidatedPlan(
  options: GeneratePlanOptions,
): Promise<{ plan: ValidatedDayPlan[]; attempts: number }> {
  const basePrompt = buildPrompt(options);
  const maxTokens = DAYS.length * options.mealTypes.length * 350;
  let retryReasons: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retryInstruction = retryReasons.length > 0
      ? `\n\nYour previous response was rejected. Correct every issue and generate the full plan again:\n${retryReasons.slice(0, 12).map((reason) => `- ${reason}`).join('\n')}`
      : '';
    let parsed: unknown;
    try {
      const content = await requestMealPlan(`${basePrompt}${retryInstruction}`, maxTokens * attempt, options.mealTypes);
      parsed = parseMealPlanContent(content);
    } catch (error) {
      if (error instanceof MealPlanProviderError && (!error.retryable || attempt === 2)) throw error;
      if (!(error instanceof MealPlanProviderError) && !(error instanceof SyntaxError)) throw error;
      retryReasons = ['Return parseable JSON with one complete array and no surrounding text.'];
      continue;
    }

    const validation = validateMealPlan(parsed, {
      mealTypes: options.mealTypes,
      servings: options.servings,
      allergies: options.allergies,
      dislikedIngredients: options.dislikedIngredients,
    });
    if (validation.success) return { plan: validation.plan, attempts: attempt };

    let repaired = await repairInvalidMeals(parsed, validation.errors, options, MODEL_FAST);
    if (repaired) {
      const repairedValidation = validateMealPlan(repaired, {
        mealTypes: options.mealTypes,
        servings: options.servings,
        allergies: options.allergies,
        dislikedIngredients: options.dislikedIngredients,
      });
      if (repairedValidation.success) {
        return { plan: repairedValidation.plan, attempts: attempt + 1 };
      }

      repaired = await repairInvalidMeals(repaired, repairedValidation.errors, options, MODEL_SMART);
      if (repaired) {
        const finalValidation = validateMealPlan(repaired, {
          mealTypes: options.mealTypes,
          servings: options.servings,
          allergies: options.allergies,
          dislikedIngredients: options.dislikedIngredients,
        });
        if (finalValidation.success) {
          return { plan: finalValidation.plan, attempts: attempt + 2 };
        }
        retryReasons = finalValidation.errors.map((error) => error.message);
        continue;
      }
    }

    retryReasons = validation.errors.map((error) =>
      error.code === 'allergen_detected'
        ? `${error.message} Exclude every requested allergy: ${options.allergies.join(', ')}.`
        : error.message
    );
  }

  throw new MealPlanSafetyError();
}

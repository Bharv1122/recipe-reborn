import { recipeGenerate, hasRecipeAIKey, canRetryRecipeAI, BackupInputError } from './ai-provider';
import { extractJsonPayload } from './ai-json';
import { normalizeImportedRecipe, type ImportPart } from './recipe-import';
import { withRequestDeadline } from './request-deadline';

export class RecipeExtractionProviderError extends Error {
  constructor() { super('Recipe reading is temporarily unavailable. Please try again later. Nothing was saved or charged.'); }
}

function extractionPrompt() {
  return `Transcribe the first complete recipe in this source faithfully. This is an import, not a request to invent, modernize, simplify, or adapt a recipe.

Return JSON only with this structure:
{
  "title": "title exactly as shown",
  "ingredients": ["every ingredient with its printed quantity"],
  "instructions": ["every instruction in source order"],
  "prepTime": "shown value or empty string",
  "cookTime": "shown value or empty string",
  "servings": "shown value or empty string",
  "reviewNotes": ["short note for any illegible, cropped, or uncertain text"]
}

Read handwritten text and sideways text in its intended reading orientation. Ignore advertisements, browser/Gallery controls, thumbnail strips, and review annotations drawn over a recipe. A missing title does not prevent transcribing ingredients and directions. Do not silently fix or substitute ingredients because of food preferences. Do not add ingredients or steps that are not visible. Preserve handwritten wording when readable. If an annotation covers a quantity, unit, or word, put [unclear] at that exact location and explain it in reviewNotes. Never infer a hidden amount from a familiar recipe or nearby ingredients. Include one instruction per actual cooking step; omit standalone headings such as "Step 1". If a title, ingredient list, or instructions cannot be recovered, return empty values for that field while preserving every other readable field.`;
}

export async function extractRecipe(source: ImportPart, requestSignal: AbortSignal, allowPartial: boolean) {
  if (!hasRecipeAIKey()) throw new RecipeExtractionProviderError();
  const parts = 'inlineData' in source
    ? [source, { text: extractionPrompt() }]
    : [{ text: `${extractionPrompt()}\n\nRECIPE SOURCE:\n${source.text}` }];
  return withRequestDeadline(requestSignal, 40_000, async (signal) => {
    const send = async () => {
      try { return await recipeGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json' },
      }),
      }); } catch (error) {
        signal.throwIfAborted();
        if (error instanceof BackupInputError) throw error;
        throw new RecipeExtractionProviderError();
      }
    };
    let response = await send();
    // Retry one transient provider failure within the same total deadline.
    if (canRetryRecipeAI(response) && [429, 500, 502, 503, 504].includes(response.status)) {
      await response.body?.cancel();
      signal.throwIfAborted();
      response = await send();
    }
    if (!response.ok) {
      console.error('[recipe-import] provider status', response.status);
      throw new RecipeExtractionProviderError();
    }
    let data;
    try { data = await response.json(); }
    catch { signal.throwIfAborted(); throw new RecipeExtractionProviderError(); }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Recipe extraction was incomplete');
    const content = candidate?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('');
    if (!content) throw new Error('Recipe extraction returned no content');
    return normalizeImportedRecipe(JSON.parse(extractJsonPayload(content)), allowPartial);
  });
}


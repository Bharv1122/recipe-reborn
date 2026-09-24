import { ApiError, apiResponse } from '@/services/api';
import { getSessionRevision } from '@/services/auth-storage';

export type ReportReason = 'unsafe' | 'offensive' | 'incorrect' | 'allergen' | 'other';
export type ReportTarget =
  | { source: 'generated'; recipe: { title: string; freshIngredients: string[]; instructions: string[] } }
  | { source: 'saved'; recipeId: string }
  | { source: 'chat'; message: string };

export async function submitContentReport(target: ReportTarget, reason: ReportReason, details: string): Promise<string> {
  const revision = getSessionRevision();
  // Send only the selected content, never a full conversation or account profile.
  const content = target.source === 'saved' ? { source: target.source, recipeId: target.recipeId }
    : target.source === 'chat' ? { source: target.source, message: target.message }
      : { source: target.source, recipe: {
        title: target.recipe.title,
        freshIngredients: target.recipe.freshIngredients,
        instructions: target.recipe.instructions,
      } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await apiResponse('/api/mobile/recipe-reports', {
      method: 'POST', body: JSON.stringify({ ...content, reason, details: details.trim() || undefined }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (revision !== getSessionRevision()) throw new ApiError('Your sign-in changed. Please try again.', 409);
    if (!response.ok) {
      const message = body?.error || body?.message;
      throw new ApiError(typeof message === 'string' ? message : 'Your report could not be sent. Please try again.', response.status);
    }
    if (response.status !== 201 || body?.ok !== true || typeof body.id !== 'string' || !body.id.trim()) {
      throw new Error('We could not confirm that your report was saved. Please try again.');
    }
    return body.id;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('We could not confirm your report in time. Please try again when your connection is ready.');
    throw error;
  } finally { clearTimeout(timer); }
}

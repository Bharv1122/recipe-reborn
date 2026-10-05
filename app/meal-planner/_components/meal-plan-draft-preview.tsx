'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { MealPlanPreview } from '@/lib/meal-plan-preview';

export function MealPlanDraftPreview({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [draft, setDraft] = useState<MealPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setDraft(null); setError(null);
    fetch(`/api/meal-plans/drafts/${id}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load preview.');
      setDraft(body.draft);
    }).catch(value => { if (!controller.signal.aborted) setError(value.message); });
    return () => controller.abort();
  }, [id, retry]);

  const save = useCallback(async (day?: string, mealType?: string) => {
    if (saving.current) return;
    saving.current = true;
    const key = day ? `${day}:${mealType}` : 'plan';
    setBusy(key); setError(null);
    try {
      const response = await fetch(`/api/meal-plans/drafts/${id}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(day ? { kind: 'meal', day, mealType } : { kind: 'plan' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save. Please try again.');
      if (!active.current) return;
      if (result.planId) onSaved();
      else setDraft(current => current ? { ...current, savedMeals: { ...current.savedMeals, [key]: result.recipeId } } : current);
    } catch (value) { if (active.current) setError(value instanceof Error ? value.message : 'Could not save. Please try again.'); }
    finally { saving.current = false; if (active.current) setBusy(null); }
  }, [id, onSaved]);

  return <section aria-label="Unsaved meal preview" className="space-y-4">
    <Card><CardContent className="pt-6 space-y-2"><h2 className="text-xl font-bold">{draft?.savedPlanId ? 'Plan saved' : 'Plan not saved'}</h2>
      <p>Save only the meals you want. Each saved meal goes to My Saved Recipes.</p>
      <p className="text-sm text-muted-foreground">This preview stays available for 7 days under Meal Planner. Leaving this page does not save a plan.</p>
    </CardContent></Card>
    {error && <div role="alert" className="rounded-lg bg-red-50 text-red-800 p-4">{error} <Button variant="outline" disabled={Boolean(busy)} onClick={() => setRetry(value => value + 1)}>Reload preview</Button></div>}
    {!draft && !error && <p role="status">Loading preview…</p>}
    {draft?.savedPlanId && <p className="text-white">This schedule is saved. You can still save its meals individually below.</p>}
    {draft?.days.map(day => <div key={day.day} className="space-y-3">
      <h3 className="capitalize text-xl font-bold text-white">{day.day}</h3>
      <div className="grid gap-3 md:grid-cols-2">{Object.entries(day.meals).filter(([, meal]) => meal).map(([mealType, meal]) => {
        const key = `${day.day}:${mealType}`;
        const savedId = draft.savedMeals[key];
        return <Card key={key}><CardContent className="pt-6 space-y-3">
          <p className="capitalize text-sm text-muted-foreground">{mealType}</p><h4 className="font-bold text-lg">{meal!.title}</h4>
          <p>{meal!.servings} servings · Prep {meal!.prepTime} · Cook {meal!.cookTime}</p>
          <details><summary className="cursor-pointer min-h-12 py-3">View recipe</summary>
            <h5 className="font-bold">Ingredients</h5><ul className="list-disc pl-5">{meal!.ingredients.map((ingredient, i) => <li key={i}>{ingredient}</li>)}</ul>
            <h5 className="font-bold mt-3">Directions</h5><p className="whitespace-pre-line">{meal!.instructions}</p>
            {meal!.estimatedCalories ? <p className="mt-2">Estimated calories per serving: {meal!.estimatedCalories}</p> : null}
          </details>
          <Button className="min-h-12" disabled={Boolean(savedId || busy)} onClick={() => save(day.day, mealType)}>{busy === key ? 'Saving…' : savedId ? 'Saved in My Saved Recipes' : 'Save to My Saved Recipes'}</Button>
          {savedId && <Link href={`/recipes/${savedId}`} className="block underline py-3">Open saved recipe</Link>}
        </CardContent></Card>;
      })}</div>
    </div>)}
    {draft && !draft.savedPlanId && <Card><CardContent className="pt-6 space-y-3"><h3 className="font-bold">Want to keep the whole week?</h3>
      <p>Save the schedule as a meal plan. Only meals you saved individually appear in My Saved Recipes.</p>
      <Button variant="outline" className="min-h-12" disabled={Boolean(busy)} onClick={() => save()}>{busy === 'plan' ? 'Saving…' : 'Save whole plan'}</Button>
    </CardContent></Card>}
  </section>;
}

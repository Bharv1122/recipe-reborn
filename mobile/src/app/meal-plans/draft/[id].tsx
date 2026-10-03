import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { apiRequest } from '@/services/api';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';
import type { MealPlanPreview } from '../../../../../lib/meal-plan-preview';

export default function MealPlanDraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return user ? <DraftContent key={`${user.id}:${id}`} id={id} /> : null;
}

function DraftContent({ id }: { id: string }) {
  const router = useRouter();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [draft, setDraft] = useState<MealPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const saving = useRef(false);
  const load = useCallback(async () => {
    setError(null);
    try { const result = await apiRequest<{ draft: MealPlanPreview }>(`/api/meal-plans/drafts/${id}`); if (active.current) setDraft(result.draft); }
    catch (value) { if (active.current) setError(value instanceof Error ? value.message : 'Could not load preview.'); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = useCallback(async (day?: string, mealType?: string) => {
    if (saving.current) return;
    saving.current = true;
    const key = day ? `${day}:${mealType}` : 'plan';
    setBusy(key); setError(null);
    try {
      const result = await apiRequest<{ recipeId?: string; planId?: string }>(`/api/meal-plans/drafts/${id}/save`, {
        method: 'POST', body: JSON.stringify(day ? { kind: 'meal', day, mealType } : { kind: 'plan' }),
      });
      if (!active.current) return;
      if (result.planId) router.replace({ pathname: '/meal-plans/[id]', params: { id: result.planId } });
      else if (result.recipeId) setDraft(current => current ? { ...current, savedMeals: { ...current.savedMeals, [key]: result.recipeId! } } : current);
    } catch (value) { if (active.current) setError(value instanceof Error ? value.message : 'Could not save. Please try again.'); }
    finally { saving.current = false; if (active.current) setBusy(null); }
  }, [id, router]);

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Meal preview', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{draft?.savedPlanId ? 'Plan saved' : 'Plan not saved'}</Text>
        <Text style={styles.body}>Save only the meals you want. Each saved meal goes to My recipes.</Text>
        <Text style={styles.body}>This preview stays available for 7 days under Meal plans. Leaving this page does not save a plan.</Text>
      </Card>
      <InlineError message={error} />
      {error ? <Button label="Retry loading preview" secondary disabled={Boolean(busy)} onPress={load} /> : null}
      {!draft && !error ? <Text style={styles.body}>Loading preview…</Text> : null}
      {draft?.savedPlanId ? <Button label="Open saved plan" secondary onPress={() => router.push({ pathname: '/meal-plans/[id]', params: { id: draft.savedPlanId! } })} /> : null}
      {draft?.days.flatMap(day => Object.entries(day.meals).filter(([, meal]) => meal).map(([mealType, meal]) => <MealPreviewCard
        key={day.day + ':' + mealType} day={day.day} mealType={mealType} meal={meal!}
        savedId={draft.savedMeals[day.day + ':' + mealType]} busy={busy}
        expanded={expanded === day.day + ':' + mealType}
        onExpand={setExpanded} onSave={save}
      />))}
      {draft && !draft.savedPlanId ? <Card><Text style={styles.title}>Want to keep the whole week?</Text>
        <Text style={styles.body}>Save the schedule as a meal plan. Only meals you saved individually appear in My recipes.</Text>
        <Button label="Save whole plan" secondary disabled={Boolean(busy)} loading={busy === 'plan'} onPress={() => save()} />
      </Card> : null}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 30 }, title: { color: colors.ink, fontWeight: '800', fontSize: 19 }, body: { color: colors.muted, lineHeight: 22 }, slot: { color: colors.green, fontWeight: '700', textTransform: 'capitalize' } });

function MealPreviewCard({ day, mealType, meal, savedId, busy, expanded, onExpand, onSave }: {
  day: string; mealType: string; meal: NonNullable<MealPlanPreview['days'][number]['meals'][string]>;
  savedId?: string; busy: string | null; expanded: boolean;
  onExpand: (key: string | null) => void; onSave: (day: string, mealType: string) => Promise<void>;
}) {
  const router = useRouter();
  const key = day + ':' + mealType;
  return <Card>
    <Text style={styles.slot}>{day} · {mealType}</Text>
    <Text style={styles.title}>{meal.title}</Text>
    <Text style={styles.body}>{meal.servings} servings · Prep {meal.prepTime} · Cook {meal.cookTime}</Text>
    <Button label={expanded ? 'Hide recipe' : 'View recipe'} secondary onPress={() => onExpand(expanded ? null : key)} />
    {expanded ? <><Text style={styles.title}>Ingredients</Text>
      {meal.ingredients.map((ingredient, index) => <Text style={styles.body} key={index}>{ingredient}</Text>)}
      <Text style={styles.title}>Directions</Text><Text style={styles.body}>{meal.instructions}</Text>
      {meal.estimatedCalories ? <Text style={styles.body}>Estimated calories per serving: {meal.estimatedCalories}</Text> : null}
    </> : null}
    <Button label={savedId ? 'Saved in My recipes' : 'Save to My recipes'} disabled={Boolean(savedId || busy)} loading={busy === key} onPress={() => onSave(day, mealType)} />
    {savedId ? <Button label="Open saved recipe" secondary disabled={Boolean(busy)} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: savedId } })} /> : null}
  </Card>;
}

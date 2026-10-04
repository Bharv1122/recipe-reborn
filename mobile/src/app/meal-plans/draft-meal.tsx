import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { RecipeDetail, type DetailSave } from '@/components/recipe-detail';
import { apiRequest, ApiError } from '@/services/api';
import { importDraft, importSnapshot } from '@/services/recipe-import';
import { colors } from '@/theme';
import type { MealPlanPreview } from '../../../../lib/meal-plan-preview';

type Meal = NonNullable<MealPlanPreview['days'][number]['meals'][string]>;

export default function DraftMealScreen() {
  const { id, day, mealType } = useLocalSearchParams<{ id: string; day: string; mealType: string }>();
  const { user } = useAuth();
  return user ? <DraftMeal key={`${user.id}:${id}:${day}:${mealType}`} id={id} day={day} mealType={mealType} /> : null;
}

function DraftMeal({ id, day, mealType }: { id: string; day: string; mealType: string }) {
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<{ draft: MealPlanPreview }>(`/api/meal-plans/drafts/${id}`).then(({ draft }) => {
      if (!active) return;
      if (draft.savedPlanId) {
        router.replace({ pathname: '/meal-plans/[id]', params: { id: draft.savedPlanId } });
        return;
      }
      const found = draft.days.find(item => item.day === day)?.meals[mealType];
      if (!found) throw new Error('This meal is no longer in the preview. Go back and reload the preview.');
      importSnapshot(importDraft(found), 8000);
      setMeal(found);
    }).catch(value => { if (active) setError(value instanceof Error ? value.message : 'Could not load this meal.'); });
    return () => { active = false; };
  }, [id, day, mealType, attempt, router]);

  const returnToPreview = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/meal-plans/draft/[id]', params: { id } });
  };
  const apply = async ({ recipe, nutrition, allowLeave }: DetailSave) => {
    if (!meal) throw new Error('Reload this meal before editing.');
    try { await apiRequest<{ draft: MealPlanPreview }>(`/api/meal-plans/drafts/${id}/meals`, {
      method: 'POST', body: JSON.stringify({ kind: 'edit', day, mealType, expectedMeal: meal, recipe, nutrition }),
    });
    } catch (value) {
      if (value instanceof ApiError && value.status === 409) {
        Alert.alert('This preview changed', 'Return to the preview to see its latest version. These unapplied edits will be discarded.', [
          { text: 'Keep reviewing', style: 'cancel' },
          { text: 'Return to preview', onPress: () => { allowLeave(); returnToPreview(); } },
        ]);
      }
      throw value;
    }
    allowLeave();
    returnToPreview();
  };

  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Preview recipe', headerTintColor: colors.green }} />
    {meal ? <RecipeDetail initial={importSnapshot(importDraft(meal), 8000)} saved savedNutrition={meal.nutrition} checkQuantities lockServings selectedTab="Meal Plans" onSave={apply}
      saveLabel="Apply changes to preview"
      saveNote="Updates this preview only. Save the meal from the preview when you’re ready."
      intro={<Card><Text style={{ color: colors.green, fontWeight: '700' }}>{day} · {mealType}</Text><Text>Ingredient changes update this preview. Servings follow your meal-plan settings.</Text></Card>}
    /> : <Screen><InlineError message={error} />{error ? <Button label="Retry loading meal" secondary onPress={() => { setError(null); setAttempt(value => value + 1); }} /> : <Text>Loading meal…</Text>}</Screen>}
  </>;
}

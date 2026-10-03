import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { RecipeDetail, type DetailSave } from '@/components/recipe-detail';
import { apiRequest } from '@/services/api';
import { getRecipe } from '@/services/recipes';
import { stageShoppingDraft } from '@/services/shopping-handoff';
import { importDraft, importSnapshot } from '@/services/recipe-import';
import { ReportContentAction } from '@/components/report-content';
import type { Recipe } from '@/types';
import { colors } from '@/theme';

export default function RecipeDetailScreen() {
  const { id, justSaved } = useLocalSearchParams<{ id: string; justSaved?: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    let active = true;
    if (id) getRecipe(id).then(data => { if (active) { importSnapshot(importDraft(data.recipe)); setRecipe(data.recipe); } }).catch(value => { if (active) setError(value.message); });
    return () => { active = false; };
  }, [id]);
  const initial = useMemo(() => recipe ? importSnapshot(importDraft(recipe)) : null, [recipe]);
  const save = async ({ recipe: shown, nutrition, changed: edited, allowLeave }: DetailSave) => {
    if (!recipe) return;
    if (!edited) {
      if (!recipe.savedAt) {
        const result = await apiRequest<{ recipe: Recipe }>('/api/mobile/recipes/' + encodeURIComponent(recipe.id), { method: 'PATCH', body: JSON.stringify({ saveToLibrary: true }) });
        setRecipe(result.recipe);
      }
      Alert.alert('Saved', 'This recipe is in My recipes.');
      return;
    }
    const result = await apiRequest<{ recipe: Recipe }>('/api/mobile/recipes', {
      method: 'POST', body: JSON.stringify({ ...shown, originalIngredients: recipe.originalIngredients || initial!.freshIngredients.join('\n'), librarySource: recipe.librarySource === 'imported' ? 'imported' : 'generated',
        ...(recipe.importSourceSnapshot ? { importSourceSnapshot: recipe.importSourceSnapshot } : {}),
        comparisonSnapshot: { version: 1, source: recipe.comparisonSnapshot?.source ?? 'dish', originalNutrition: recipe.comparisonSnapshot?.originalNutrition ?? null, freshNutrition: nutrition },
      }),
    });
    allowLeave();
    router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
  };
  const remove = () => Alert.alert('Remove from My recipes?', 'The recipe stays in meal plans and collections that already use it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await apiRequest('/api/mobile/recipes/' + encodeURIComponent(id), { method: 'DELETE' }); router.back(); }
      catch (value) { setError(value instanceof Error ? value.message : 'Could not remove the saved recipe.'); }
    } },
  ]);
  if (!recipe || recipe.id !== id || !initial) return <Screen><InlineError message={error} /><Text>Loading recipe…</Text></Screen>;
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Your recipe', headerTintColor: colors.white, headerStyle: { backgroundColor: colors.green } }} />
    <RecipeDetail key={recipe.id} initial={initial} sourceRecipe={recipe.importSourceSnapshot} saved={Boolean(recipe.savedAt)} originalIngredients={recipe.originalIngredients} savedNutrition={recipe.comparisonSnapshot?.freshNutrition} packageNutrition={recipe.comparisonSnapshot?.originalNutrition} isPackage={recipe.comparisonSnapshot?.source === 'label'} onSave={save} onChange={setChanged}
      intro={<><InlineError message={error} />{justSaved === '1' ? <Text style={{ color: colors.green }}>Saved in My recipes</Text> : null}</>}
      extra={<Card>
        {recipe.librarySource === 'imported' && !recipe.importSourceSnapshot ? <Text style={{ color: colors.muted }}>This older import has no preserved source; source revert is unavailable.</Text> : null}
        <Button label="Add to a meal plan" disabled={changed} onPress={() => router.push({ pathname: '/meal-plans', params: { recipeId: recipe.id } })} />
        <Button label="Shop for these ingredients" secondary disabled={changed} onPress={() => { stageShoppingDraft({ title: recipe.title, ingredients: initial.freshIngredients }); router.push('/(tabs)/shopping'); }} />
        {changed ? <Text style={{ color: colors.muted }}>Save your new copy before adding it to a meal plan or shopping for all ingredients.</Text> : null}
        <Button label="Ask AI Chef" secondary onPress={() => router.push('/chat')} />
        <ReportContentAction target={{ source: 'saved', recipeId: recipe.id }} />
        <Button label={showMore ? 'Fewer recipe options' : 'More recipe options'} secondary onPress={() => setShowMore(value => !value)} />
        {showMore ? <>{recipe.savedAt ? <Button label="Add to collection" secondary disabled={changed} onPress={() => router.push({ pathname: '/collections', params: { recipeId: recipe.id } })} /> : null}{recipe.savedAt ? <Button label="Remove from My recipes" secondary onPress={remove} /> : null}</> : null}
      </Card>} />
  </>;
}

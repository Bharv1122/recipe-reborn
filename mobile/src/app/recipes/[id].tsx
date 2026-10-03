import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { getRecipe } from '@/services/recipes';
import { stageShoppingDraft } from '@/services/shopping-handoff';
import type { Recipe } from '@/types';
import { colors } from '@/theme';
import { RecipeComparison } from '@/components/recipe-comparison';
import { ReportContentAction } from '@/components/report-content';
import { adaptImportedDraft, importDraft, saveImportPayload, type ImportAdaptationAction, type ImportDraft } from '@/services/recipe-import';
import { useAuth } from '@/providers/auth-provider';

export default function RecipeDetailScreen() {
  const { id, justSaved } = useLocalSearchParams<{ id: string; justSaved?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ImportDraft | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [substitute, setSubstitute] = useState('');
  const [oneRecipeDiet, setOneRecipeDiet] = useState('');
  const [adaptationNotes, setAdaptationNotes] = useState('');
  const [adapting, setAdapting] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const adaptationAbort = useRef<AbortController | null>(null);
  useEffect(() => () => adaptationAbort.current?.abort(), []);
  useEffect(() => { if (id) getRecipe(id).then((data) => setRecipe(data.recipe)).catch((value) => setError(value.message)); }, [id]);
  const savedDraft = useMemo(() => recipe ? importDraft({ title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions, prepTime: recipe.prepTime, cookTime: recipe.cookTime, servings: recipe.servings, dietaryTags: recipe.dietaryTags }) : null, [recipe]);
  const storedSourceDraft = useMemo(() => {
    if (!recipe?.importSourceSnapshot) return null;
    try { return importDraft(recipe.importSourceSnapshot); }
    catch { return null; }
  }, [recipe]);
  const sourceDraft = storedSourceDraft ?? savedDraft;
  const shownDraft = pendingDraft ?? savedDraft;
  const ingredients = useMemo(() => shownDraft ? shownDraft.ingredients.split(/\r?\n/).filter(Boolean) : [], [shownDraft]);
  const instructions = useMemo(() => shownDraft ? shownDraft.instructions.split(/\r?\n/).filter(Boolean) : [], [shownDraft]);
  const activeIngredient = ingredients.includes(selectedIngredient) ? selectedIngredient : ingredients[0] ?? '';

  const adapt = async (action: ImportAdaptationAction) => {
    if (!shownDraft || adapting) return;
    const controller = new AbortController(); adaptationAbort.current = controller;
    setAdapting(true); setError(null);
    try {
      const result = await adaptImportedDraft(shownDraft, action, controller.signal);
      if (controller.signal.aborted) return;
      const adapted = importDraft(result.recipe);
      setPendingDraft(adapted); setSubstitute('');
      setAdaptationNotes([result.changeSummary, ...result.reviewNotes].filter(Boolean).join('\n'));
    } catch (value) { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'The recipe could not be adapted. The saved recipe is unchanged.'); }
    finally { if (adaptationAbort.current === controller) adaptationAbort.current = null; setAdapting(false); }
  };
  const saveAdaptedCopy = async () => {
    if (!pendingDraft || !sourceDraft || savingCopy) return;
    setSavingCopy(true); setError(null);
    try {
      const result = await apiRequest<{ recipe: Recipe }>('/api/mobile/recipes', { method: 'POST', body: JSON.stringify(saveImportPayload(pendingDraft, sourceDraft)) });
      setPendingDraft(null); setAdaptationNotes('');
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save the adapted copy. The original is unchanged.'); }
    finally { setSavingCopy(false); }
  };

  const saveToLibrary = async () => {
    if (!recipe || savingLibrary) return;
    setSavingLibrary(true); setError(null);
    try {
      const result = await apiRequest<{ recipe: Recipe }>(`/api/mobile/recipes/${id}`, { method: 'PATCH', body: JSON.stringify({ saveToLibrary: true }) });
      setRecipe(result.recipe);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save this recipe.'); }
    finally { setSavingLibrary(false); }
  };
  const remove = () => Alert.alert('Remove from My recipes?', 'The recipe stays in meal plans and collections that already use it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await apiRequest(`/api/mobile/recipes/${id}`, { method: 'DELETE' }); router.back(); }
      catch (value) { setError(value instanceof Error ? value.message : 'Could not remove the saved recipe.'); }
    } },
  ]);

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipe?.title || 'Recipe', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <InlineError message={error} />
      {recipe ? <Card>
        {justSaved === '1' ? <Text style={styles.heading}>Saved in My recipes</Text> : null}
        <Text style={styles.title}>{shownDraft?.title ?? recipe.title}</Text>
        <Text style={styles.meta}>{[shownDraft?.prepTime, shownDraft?.cookTime, shownDraft?.servings && `${shownDraft.servings} servings`].filter(Boolean).join(' · ')}</Text>
        {pendingDraft ? <Text accessibilityLiveRegion="polite" style={styles.warning}>Adapted copy is ready for review. The saved original, its meal plans, and shopping lists are unchanged.</Text> : null}
        {!recipe.savedAt ? <Button label="Save to My recipes" onPress={saveToLibrary} loading={savingLibrary} /> : null}
        <Button label="Add to a meal plan" disabled={Boolean(pendingDraft)} onPress={() => router.push({ pathname: '/meal-plans', params: { recipeId: recipe.id } })} />
        <Button label="Shop for these ingredients" secondary disabled={Boolean(pendingDraft)} onPress={() => { stageShoppingDraft({ title: recipe.title, ingredients }); router.push('/(tabs)/shopping'); }} />
        <Text style={styles.heading}>Fresh ingredients</Text>
        {ingredients.map((item, index) => <Text key={`${item}-${index}`} style={styles.body}>• {item}</Text>)}
        <Text style={styles.heading}>Instructions</Text>
        {instructions.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>{index + 1}. {item}</Text>)}
        {recipe.librarySource === 'imported' ? <View style={styles.adaptBox}>
          <Text style={styles.heading}>Adapt imported recipe</Text>
          <Text style={styles.body}>Substitute or remove one selected ingredient, or apply saved preferences to this recipe only. Review the complete copy before saving.</Text>
          {adaptationNotes ? <Text style={styles.warning}>{adaptationNotes}</Text> : null}
          {ingredients.map(item => <Pressable accessibilityRole="radio" accessibilityState={{ checked: activeIngredient === item }} key={item} onPress={() => setSelectedIngredient(item)} style={[styles.ingredientChoice, activeIngredient === item && styles.ingredientSelected]}><Text style={styles.body}>{activeIngredient === item ? 'Selected: ' : ''}{item}</Text></Pressable>)}
          <Field accessibilityLabel="Substitute ingredient" value={substitute} onChangeText={setSubstitute} placeholder="Substitute with…" editable={!adapting} />
          <Button label="Substitute selected ingredient" disabled={!activeIngredient || !substitute.trim()} loading={adapting} onPress={() => void adapt({ type: 'substitute', original: activeIngredient, substitute: substitute.trim() })} />
          <Button label="Remove selected ingredient" secondary disabled={!activeIngredient || adapting} onPress={() => void adapt({ type: 'remove', original: activeIngredient })} />
          <Text style={styles.body}>Allergies to avoid: {user?.allergies?.join(', ') || 'none saved'} · Dislikes: {user?.dislikedIngredients?.join(', ') || 'none saved'} · Likes: {user?.likedIngredients?.join(', ') || 'none saved'}</Text>
          <Field accessibilityLabel="One-recipe dietary request" value={oneRecipeDiet} onChangeText={setOneRecipeDiet} placeholder="Optional, e.g. vegetarian" editable={!adapting} />
          <Button label="Apply my preferences — this recipe only" secondary disabled={adapting} onPress={() => void adapt({ type: 'preferences', oneRecipeDiet: oneRecipeDiet.trim() })} />
          {adapting ? <Button label="Cancel adaptation" secondary onPress={() => adaptationAbort.current?.abort()} /> : null}
          {storedSourceDraft ? <Button label="Revert copy to imported source" secondary disabled={adapting} onPress={() => { setPendingDraft(storedSourceDraft); setAdaptationNotes('Restored the faithful imported source as an unsaved copy.'); }} /> : null}
          {!storedSourceDraft ? <Text style={styles.warning}>This older import has no preserved source snapshot, so source revert is unavailable. You can still review and save an adapted copy; the saved recipe remains unchanged.</Text> : null}
          {pendingDraft ? <><Button label="Save adapted copy" onPress={saveAdaptedCopy} loading={savingCopy} /><Button label="Discard adapted copy" secondary disabled={savingCopy} onPress={() => { setPendingDraft(null); setAdaptationNotes(''); }} /></> : null}
          <Text style={styles.body}>Saving creates a new recipe so the original and anything already planned or shopped stay unchanged. Adaptations do not use another monthly recipe generation. Review product labels; allergy checks are bounded safeguards, not a medical guarantee.</Text>
        </View> : null}
        <Button label="Need cooking help? Ask AI Chef" secondary onPress={() => router.push('/chat')} />
        <ReportContentAction target={{ source: 'saved', recipeId: recipe.id }} />
        <Button label={showMore ? 'Hide recipe options' : 'More recipe options'} secondary onPress={() => setShowMore(!showMore)} />
        {showMore ? <>
          {recipe.savedAt ? <Button label="Add to collection" secondary onPress={() => router.push({ pathname: '/collections', params: { recipeId: recipe.id } })} /> : null}
          {recipe.savedAt ? <Button label="Remove from My recipes" secondary onPress={remove} /> : null}
        </> : null}
      </Card> : <Text style={styles.meta}>Loading recipe…</Text>}
      {recipe?.comparisonSnapshot && !pendingDraft ? <RecipeComparison
        key={recipe.id}
        recipe={{ title: recipe.title, freshIngredients: ingredients, instructions, prepTime: recipe.prepTime || '', cookTime: recipe.cookTime || '', servings: recipe.servings || '' }}
        originalIngredients={recipe.originalIngredients}
        original={recipe.comparisonSnapshot.originalNutrition}
        isPackage={recipe.comparisonSnapshot.source === 'label'}
        savedNutrition={recipe.comparisonSnapshot.freshNutrition}
        estimateOnMount={false}
      /> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, title: { color: colors.greenDark, fontSize: 25, fontWeight: '800' },
  meta: { color: colors.muted }, heading: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 8 }, body: { color: colors.ink, lineHeight: 22 }, warning: { color: '#8A4B08', backgroundColor: '#FFF4D6', borderRadius: 10, padding: 12, lineHeight: 20 }, adaptBox: { gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: '#F4FBF6' }, ingredientChoice: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.white }, ingredientSelected: { borderColor: colors.green, backgroundColor: '#EAF7ED' },
});

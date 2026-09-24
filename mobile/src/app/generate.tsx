import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { cancelRecipeGeneration, generateRecipe, saveGeneratedRecipe } from '@/services/recipes';
import { takeScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import type { GeneratedRecipe } from '@/types';
import { colors } from '@/theme';
import { PackageNutritionReview, RecipeComparison, type NutritionEstimateStatus } from '@/components/recipe-comparison';
import { VoiceInput } from '@/components/voice-input';
import { ReportContentAction } from '@/components/report-content';
import type { FreshNutritionEstimate, OriginalNutrition } from '../../../shared/nutrition-facts';

type Source = 'label' | 'pantry' | 'dish';
export default function GenerateScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(() => ['label', 'pantry', 'dish'].includes(params.source || '') ? params.source as Source : null);
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestriction, setDietaryRestriction] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedFrom, setGeneratedFrom] = useState('');
  const [scanContext, setScanContext] = useState('');
  const [originalNutrition, setOriginalNutrition] = useState<OriginalNutrition | null>(null);
  const [freshNutrition, setFreshNutrition] = useState<FreshNutritionEstimate | null>(null);
  const [nutritionStatus, setNutritionStatus] = useState<NutritionEstimateStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    const handoff = takeScanRecipeHandoff();
    if (!handoff) return;
    setSource(handoff.source);
    setIngredients(handoff.ingredients);
    setScanContext(handoff.context || 'Your reviewed ingredients');
    setOriginalNutrition(handoff.originalNutrition ?? null);
    setRecipe(null); setFreshNutrition(null); setNutritionStatus('pending'); setGeneratedFrom(''); setError(null);
  }, []));

  const run = async () => {
    const input = ingredients.trim();
    if (!input || !source || abortRef.current || voiceBusy) return;
    const controller = new AbortController();
    const generationId = Crypto.randomUUID();
    abortRef.current = controller; generationIdRef.current = generationId;
    setGeneratedFrom(input); setBusy(true); setError(null); setRecipe(null); setFreshNutrition(null); setNutritionStatus('pending');
    try {
      const result = await generateRecipe(input, { source, dietaryRestriction: dietaryRestriction.trim() || undefined, signal: controller.signal, generationId });
      setRecipe(result.recipe);
    } catch (value) {
      setError(controller.signal.aborted ? 'Canceled. Your ingredients are still here.' : value instanceof Error ? value.message : 'Could not create your recipe. Please try again.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      generationIdRef.current = null; setBusy(false);
    }
  };
  const cancel = async () => {
    try { if (generationIdRef.current) await cancelRecipeGeneration(generationIdRef.current); }
    catch (value) { setError(value instanceof Error ? value.message : 'Cancellation could not be confirmed.'); }
    finally { abortRef.current?.abort(); }
  };
  const save = async () => {
    if (!recipe || !source || savingRef.current || nutritionStatus === 'pending') return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const result = await saveGeneratedRecipe(generatedFrom, recipe, {
        version: 1, source,
        originalNutrition: source === 'label' ? originalNutrition : null,
        freshNutrition,
      });
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save recipe. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const title = scanContext ? 'Check your ingredients' : source === 'label' ? 'Enter the label ingredients' : source === 'pantry' ? 'What ingredients do you have?' : 'What would you like to make?';
  const saveLabel = nutritionStatus === 'pending' ? 'Finishing nutrition estimate…' : nutritionStatus === 'failed' ? 'Save without nutrition estimate' : 'Save to My recipes';
  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipe ? 'Your recipe' : source === 'pantry' ? 'Use my ingredients' : source === 'dish' ? 'Choose a dish' : 'Make a recipe', headerTintColor: colors.green }} />
    <ScrollView key={recipe ? 'result' : busy ? 'working' : 'input'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <InlineError message={error} />
      {busy ? <Card>
        <Text style={styles.title}>Making your recipe…</Text>
        <Text style={styles.body}>This can take a moment. Your recipe will appear here when it is ready.</Text>
        <Button label="Cancel" secondary onPress={cancel} />
      </Card> : recipe ? <>
        <Card>
          <Text style={styles.eyebrow}>READY TO COOK</Text>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <Text style={styles.body}>{recipe.prepTime} prep · {recipe.cookTime} cook · {recipe.servings} servings</Text>
          <Text style={styles.body}>Save it to keep it in My recipes and add it to a meal plan.</Text>
          <Button label={saveLabel} onPress={save} loading={saving} disabled={nutritionStatus === 'pending'} />
        </Card>
        <RecipeComparison recipe={recipe} originalIngredients={generatedFrom} original={originalNutrition} isPackage={source === 'label'} onNutrition={setFreshNutrition} onStatusChange={setNutritionStatus} />
        <Card>
          <Text style={styles.heading}>Ingredients</Text>
          {recipe.freshIngredients.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>• {item}</Text>)}
          <Text style={styles.heading}>Cooking steps</Text>
          {recipe.instructions.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>{index + 1}. {item}</Text>)}
          <Button label={saveLabel} onPress={save} loading={saving} disabled={nutritionStatus === 'pending'} />
          <Button label="Change ingredients" secondary disabled={saving} onPress={() => { setRecipe(null); setError(null); }} />
          <ReportContentAction target={{ source: 'generated', recipe: { title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions } }} />
        </Card>
      </> : !source ? <Card>
        <Text style={styles.title}>Where would you like to start?</Text>
        <Button label="Scan a package" onPress={() => router.replace('/(tabs)/scan')} />
        <Button label="Use my ingredients" secondary onPress={() => setSource('pantry')} />
        <Button label="Choose a dish" secondary onPress={() => setSource('dish')} />
      </Card> : <Card>
        <Text style={styles.title}>{title}</Text>
        {scanContext ? <Text style={styles.body}>{scanContext}</Text> : null}
        <Text style={styles.body}>{source === 'label' ? 'Check the ingredient list below. You can correct it before we make a homemade version.' : source === 'pantry' ? 'List a few things in your kitchen, such as eggs, spinach and rice.' : 'Type a dish you love, such as chicken enchiladas.'}</Text>
        {source === 'pantry' && !scanContext ? <Button label="Photograph my fridge or pantry" secondary disabled={voiceBusy} onPress={() => router.push('/pantry-review')} /> : null}
        <Field accessibilityLabel={source === 'dish' ? 'Dish name' : 'Ingredients'} editable={!voiceBusy} multiline textAlignVertical="top" placeholder={source === 'dish' ? 'What would you like to cook?' : 'Enter ingredients here'} value={ingredients} onChangeText={setIngredients} style={styles.multiline} />
        <VoiceInput label={source === 'dish' ? 'Speak my recipe request' : 'Speak my ingredients'} onBusyChange={setVoiceBusy} onTranscript={(text) => setIngredients((current) => [current.trim(), text].filter(Boolean).join('\n'))} />
        {source === 'label' && originalNutrition ? <PackageNutritionReview value={originalNutrition} onChange={setOriginalNutrition} /> : null}
        <Text style={styles.note}>Your saved allergies and food preferences apply.</Text>
        <Button label={showPreferences ? 'Hide optional requests' : 'Add a dietary request (optional)'} secondary onPress={() => setShowPreferences(!showPreferences)} />
        {showPreferences ? <Field accessibilityLabel="Dietary request" placeholder="For example, vegetarian" value={dietaryRestriction} onChangeText={setDietaryRestriction} /> : null}
        <Button label="Make my recipe" onPress={run} disabled={!ingredients.trim() || voiceBusy} />
      </Card>}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 24 }, title: { fontSize: 22, fontWeight: '800', color: colors.greenDark },
  multiline: { minHeight: 115, paddingTop: 14 }, body: { color: colors.ink, lineHeight: 23 }, note: { color: colors.muted, lineHeight: 20 },
  eyebrow: { color: colors.orange, fontWeight: '800', fontSize: 12 }, recipeTitle: { color: colors.greenDark, fontSize: 25, fontWeight: '800' }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 6 },
});

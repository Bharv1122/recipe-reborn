import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { cancelRecipeGeneration, generateRecipe, saveGeneratedRecipe } from '@/services/recipes';
import { takeScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import type { GeneratedRecipe } from '@/types';
import { colors } from '@/theme';
import { RecipeDetail, type DetailSave } from '@/components/recipe-detail';
import { VoiceInput } from '@/components/voice-input';
import { ReportContentAction } from '@/components/report-content';
import type { OriginalNutrition } from '../../../shared/nutrition-facts';

type Source = 'label' | 'pantry' | 'dish';
export default function GenerateScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(() => ['label', 'pantry', 'dish'].includes(params.source || '') ? params.source as Source : null);
  const [ingredients, setIngredients] = useState('');
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [generatedFrom, setGeneratedFrom] = useState('');
  const [scanContext, setScanContext] = useState('');
  const [productName, setProductName] = useState('');
  const [pantryTargetTitle, setPantryTargetTitle] = useState('');
  const [fromIngredientImport, setFromIngredientImport] = useState(false);
  const [originalNutrition, setOriginalNutrition] = useState<OriginalNutrition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    const handoff = takeScanRecipeHandoff();
    if (!handoff) return;
    setSource(handoff.source);
    setProductName(handoff.productName || '');
    setPantryTargetTitle(handoff.pantryTargetTitle || '');
    setFromIngredientImport(handoff.origin === 'import-ingredients');
    setIngredients(handoff.ingredients);
    setScanContext(handoff.context || 'Your reviewed ingredients');
    setOriginalNutrition(handoff.originalNutrition ?? null);
    setRecipe(null); setGeneratedFrom(''); setError(null);
  }, []));

  const run = async () => {
    const input = ingredients.trim();
    if (!input || !source || abortRef.current || voiceBusy) return;
    const controller = new AbortController();
    const generationId = Crypto.randomUUID();
    abortRef.current = controller; generationIdRef.current = generationId;
    setGeneratedFrom(input); setBusy(true); setError(null); setRecipe(null);
    try {
      const result = await generateRecipe(input, { source, productName: productName || undefined, pantryTargetTitle: pantryTargetTitle || undefined, signal: controller.signal, generationId });
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
  const save = async ({ recipe: shown, nutrition, allowLeave }: DetailSave) => {
    if (!source || savingRef.current) return;
    savingRef.current = true;
    try {
      const result = await saveGeneratedRecipe(generatedFrom, shown, {
        version: 1, source,
        originalNutrition: source === 'label' ? originalNutrition : null,
        freshNutrition: nutrition,
      });
      allowLeave();
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } finally { savingRef.current = false; }
  };
  const title = scanContext ? 'Check your ingredients' : source === 'label' ? 'Enter the label ingredients' : source === 'pantry' ? 'What ingredients do you have?' : 'What would you like to make?';
  if (recipe) return <>
    <Stack.Screen options={{ headerShown: true, title: 'Your recipe', headerTintColor: colors.white, headerStyle: { backgroundColor: colors.green } }} />
    <RecipeDetail initial={recipe} originalIngredients={generatedFrom} packageNutrition={originalNutrition} onPackageNutritionChange={setOriginalNutrition} isPackage={source === 'label'} onSave={save}
      intro={fromIngredientImport ? <Card><Text style={styles.body}>AI-created recipe from your imported ingredients. The cooking steps were not present in your source.</Text></Card> : undefined}
      extra={<ReportContentAction target={{ source: 'generated', recipe: { title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions } }} />} />
  </>;
  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipe ? 'Your recipe' : source === 'pantry' ? 'Use my ingredients' : source === 'dish' ? 'Choose a dish' : 'Make a recipe', headerTintColor: colors.green }} />
    <ScrollView key={recipe ? 'result' : busy ? 'working' : 'input'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <InlineError message={error} />
      {busy ? <Card>
        <Text style={styles.title}>Making your recipe…</Text>
        <Text style={styles.body}>This can take a moment. Your recipe will appear here when it is ready.</Text>
        <Button label="Cancel" secondary onPress={cancel} />
      </Card> : !source ? <Card>
        <Text style={styles.title}>Where would you like to start?</Text>
        <Button label="Scan a package" onPress={() => router.replace('/(tabs)/scan')} />
        <Button label="Use my ingredients" secondary onPress={() => setSource('pantry')} />
        <Button label="Choose a dish" secondary onPress={() => setSource('dish')} />
      </Card> : <Card>
        <Text style={styles.title}>{title}</Text>
        {scanContext ? <Text style={styles.body}>{scanContext}</Text> : null}
        {fromIngredientImport ? <Text style={styles.note}>This creates a new recipe with AI-written steps and uses one recipe generation. Your source is not rewritten.</Text> : null}
        <Text style={styles.body}>{source === 'label' ? 'Check the ingredient list below. You can correct it before we make a homemade version.' : source === 'pantry' ? 'List a few things in your kitchen, such as eggs, spinach and rice.' : 'Type a dish you love, such as chicken enchiladas.'}</Text>
        {source === 'pantry' && !scanContext ? <Button label="Photograph my fridge or pantry" secondary disabled={voiceBusy} onPress={() => router.push('/pantry-review')} /> : null}
        <Field accessibilityLabel={source === 'dish' ? 'Dish name' : 'Ingredients'} editable={!voiceBusy} multiline textAlignVertical="top" placeholder={source === 'dish' ? 'What would you like to cook?' : 'Enter ingredients here'} value={ingredients} onChangeText={value => { setIngredients(value); if (!value.trim()) { setPantryTargetTitle(''); setFromIngredientImport(false); setProductName(''); } }} style={styles.multiline} />
        <VoiceInput label={source === 'dish' ? 'Speak my recipe request' : 'Speak my ingredients'} onBusyChange={setVoiceBusy} onTranscript={(text) => setIngredients((current) => [current.trim(), text].filter(Boolean).join('\n'))} />
        <Text style={styles.note}>Your saved allergies and food preferences apply.</Text>
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

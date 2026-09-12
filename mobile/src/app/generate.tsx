import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { cancelRecipeGeneration, generateRecipe, saveGeneratedRecipe } from '@/services/recipes';
import { takeScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import type { GeneratedRecipe } from '@/types';
import { colors } from '@/theme';

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
  const [saving, setSaving] = useState(false);
  const [generatedFrom, setGeneratedFrom] = useState('');
  const [scanContext, setScanContext] = useState('');
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
    setRecipe(null); setGeneratedFrom(''); setError(null);
  }, []));

  const run = async () => {
    const input = ingredients.trim();
    if (!input || !source || abortRef.current) return;
    const controller = new AbortController();
    const generationId = Crypto.randomUUID();
    abortRef.current = controller; generationIdRef.current = generationId;
    setGeneratedFrom(input); setBusy(true); setError(null); setRecipe(null);
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
    if (!recipe || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const result = await saveGeneratedRecipe(generatedFrom, recipe);
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save recipe. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const title = scanContext ? 'Check your ingredients' : source === 'label' ? 'Enter the label ingredients' : source === 'pantry' ? 'What ingredients do you have?' : 'What would you like to make?';
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
          <Button label="Save to My recipes" onPress={save} loading={saving} />
        </Card>
        <Card>
          <Text style={styles.heading}>Ingredients</Text>
          {recipe.freshIngredients.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>• {item}</Text>)}
          <Text style={styles.heading}>Cooking steps</Text>
          {recipe.instructions.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>{index + 1}. {item}</Text>)}
          <Button label="Save to My recipes" onPress={save} loading={saving} />
          <Button label="Change ingredients" secondary disabled={saving} onPress={() => { setRecipe(null); setError(null); }} />
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
        <Field accessibilityLabel={source === 'dish' ? 'Dish name' : 'Ingredients'} multiline textAlignVertical="top" placeholder={source === 'dish' ? 'What would you like to cook?' : 'Enter ingredients here'} value={ingredients} onChangeText={setIngredients} style={styles.multiline} />
        <Text style={styles.note}>Your saved allergies and food preferences apply.</Text>
        <Button label={showPreferences ? 'Hide optional requests' : 'Add a dietary request (optional)'} secondary onPress={() => setShowPreferences(!showPreferences)} />
        {showPreferences ? <Field accessibilityLabel="Dietary request" placeholder="For example, vegetarian" value={dietaryRestriction} onChangeText={setDietaryRestriction} /> : null}
        <Button label="Make my recipe" onPress={run} disabled={!ingredients.trim()} />
        {source === 'pantry' && !scanContext ? <Button label="Use a photo of my ingredients" secondary onPress={() => router.push('/pantry-review')} /> : null}
      </Card>}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 24 }, title: { fontSize: 22, fontWeight: '800', color: colors.greenDark },
  multiline: { minHeight: 115, paddingTop: 14 }, body: { color: colors.ink, lineHeight: 23 }, note: { color: colors.muted, lineHeight: 20 },
  eyebrow: { color: colors.orange, fontWeight: '800', fontSize: 12 }, recipeTitle: { color: colors.greenDark, fontSize: 25, fontWeight: '800' }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 6 },
});

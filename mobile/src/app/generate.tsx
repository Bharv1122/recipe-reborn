import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { cancelRecipeGeneration, generateRecipe, saveGeneratedRecipe } from '@/services/recipes';
import { takeScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import type { GeneratedRecipe } from '@/types';
import { colors } from '@/theme';

export default function GenerateScreen() {
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestriction, setDietaryRestriction] = useState('');
  const [source, setSource] = useState<'label' | 'pantry' | 'dish'>('label');
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatedFrom, setGeneratedFrom] = useState('');
  const [scanContext, setScanContext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    const handoff = takeScanRecipeHandoff();
    if (!handoff) return;
    setSource(handoff.source);
    setIngredients(handoff.ingredients);
    setScanContext(handoff.context);
    setRecipe(null);
    setSaved(false);
    setGeneratedFrom('');
    setError(null);
  }, []));

  const chooseSource = (next: 'label' | 'pantry' | 'dish') => {
    setSource(next);
    setScanContext('');
  };

  const run = async (random = false) => {
    const input = random ? 'Surprise me with a random recipe' : ingredients.trim();
    if (!input) return;
    const controller = new AbortController();
    const generationId = Crypto.randomUUID();
    abortRef.current = controller;
    generationIdRef.current = generationId;
    setGeneratedFrom(input);
    setBusy(true); setError(null); setRecipe(null); setSaved(false);
    try {
      const result = await generateRecipe(input, {
        source: random ? 'random' : source, dietaryRestriction: dietaryRestriction.trim() || undefined,
        signal: controller.signal, generationId,
      });
      setRecipe(result.recipe);
    } catch (value) {
      if (controller.signal.aborted) setError('Generation canceled. Your ingredients are still here.');
      else setError(value instanceof Error ? value.message : 'Recipe generation failed.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      generationIdRef.current = null;
      setBusy(false);
    }
  };

  const cancel = async () => {
    const generationId = generationIdRef.current;
    try { if (generationId) await cancelRecipeGeneration(generationId); }
    catch (value) { setError(value instanceof Error ? value.message : 'Cancellation could not be confirmed.'); }
    finally { abortRef.current?.abort(); }
  };

  const save = async () => {
    if (!recipe) return;
    setError(null);
    try { await saveGeneratedRecipe(generatedFrom || ingredients.trim(), recipe); setSaved(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not save recipe.'); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Create a recipe', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>What would you like to make?</Text>
        {scanContext ? <View style={styles.reviewNotice}>
          <Text style={styles.reviewTitle}>Review the scanned ingredients</Text>
          <Text style={styles.note}>{scanContext}. Correct anything the scan missed or misread before tapping Generate recipe.</Text>
        </View> : null}
        <View style={styles.row}>
          <Button label="Package label" secondary={source !== 'label'} onPress={() => chooseSource('label')} />
          <Button label="Pantry items" secondary={source !== 'pantry'} onPress={() => chooseSource('pantry')} />
        </View>
        <Button label="Specific dish" secondary={source !== 'dish'} onPress={() => chooseSource('dish')} />
        <Field
          accessibilityLabel="Ingredients"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholder={source === 'label'
            ? 'Paste the packaged ingredient list'
            : source === 'pantry'
              ? 'List what you have in the fridge or pantry'
              : 'Type the recipe you want, such as chicken enchiladas'}
          value={ingredients}
          onChangeText={setIngredients}
          style={styles.multiline}
        />
        <Field accessibilityLabel="Dietary restriction" placeholder="Dietary request (optional)" value={dietaryRestriction} onChangeText={setDietaryRestriction} />
        <Text style={styles.note}>Your saved allergies and disliked ingredients are applied by the server. The app cannot override them.</Text>
        {busy ? <Button label="Cancel generation" secondary onPress={cancel} /> : <View style={styles.actions}>
          <View style={styles.action}><Button label="Generate recipe" onPress={() => run(false)} disabled={!ingredients.trim()} /></View>
          <View style={styles.action}><Button label="Random" secondary onPress={() => run(true)} /></View>
        </View>}
      </Card>
      <InlineError message={error} />
      {recipe ? <Card>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.meta}>{recipe.prepTime} prep · {recipe.cookTime} cook · {recipe.servings} servings</Text>
        <Text style={styles.heading}>Fresh ingredients</Text>
        {recipe.freshIngredients.map((item, index) => <Text key={`${item}-${index}`} style={styles.body}>• {item}</Text>)}
        <Text style={styles.heading}>Instructions</Text>
        {recipe.instructions.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>{index + 1}. {item}</Text>)}
        <Button label={saved ? 'Saved' : 'Save recipe'} onPress={save} disabled={saved} />
      </Card> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, row: { flexDirection: 'row', gap: 8 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink }, multiline: { minHeight: 130, paddingTop: 14 },
  reviewNotice: { gap: 5, borderWidth: 1, borderColor: colors.green, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12 },
  reviewTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  note: { color: colors.muted, lineHeight: 19 }, recipeTitle: { color: colors.greenDark, fontSize: 24, fontWeight: '800' },
  meta: { color: colors.muted }, heading: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 6 }, body: { color: colors.ink, lineHeight: 22 },
});

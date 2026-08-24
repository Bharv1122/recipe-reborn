import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Stack } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { cancelRecipeGeneration, generateRecipe, saveGeneratedRecipe } from '@/services/recipes';
import type { GeneratedRecipe } from '@/types';
import { colors } from '@/theme';

export default function GenerateScreen() {
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestriction, setDietaryRestriction] = useState('');
  const [source, setSource] = useState<'label' | 'pantry'>('label');
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef<string | null>(null);

  const run = async () => {
    const input = ingredients.trim();
    if (!input) return;
    const controller = new AbortController();
    const generationId = Crypto.randomUUID();
    abortRef.current = controller;
    generationIdRef.current = generationId;
    setBusy(true); setError(null); setRecipe(null); setSaved(false);
    try {
      const result = await generateRecipe(input, {
        source, dietaryRestriction: dietaryRestriction.trim() || undefined,
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
    try { await saveGeneratedRecipe(ingredients.trim(), recipe); setSaved(true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not save recipe.'); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Create a recipe', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>What are we transforming?</Text>
        <View style={styles.row}>
          <Button label="Package label" secondary={source !== 'label'} onPress={() => setSource('label')} />
          <Button label="Pantry items" secondary={source !== 'pantry'} onPress={() => setSource('pantry')} />
        </View>
        <Field
          accessibilityLabel="Ingredients"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholder={source === 'label' ? 'Paste the packaged ingredient list' : 'List what you have in the fridge or pantry'}
          value={ingredients}
          onChangeText={setIngredients}
          style={styles.multiline}
        />
        <Field accessibilityLabel="Dietary restriction" placeholder="Dietary request (optional)" value={dietaryRestriction} onChangeText={setDietaryRestriction} />
        <Text style={styles.note}>Your saved allergies and disliked ingredients are applied by the server. The app cannot override them.</Text>
        {busy ? <Button label="Cancel generation" secondary onPress={cancel} /> : <Button label="Generate recipe" onPress={run} disabled={!ingredients.trim()} />}
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
  content: { gap: 14, paddingBottom: 30 }, row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink }, multiline: { minHeight: 130, paddingTop: 14 },
  note: { color: colors.muted, lineHeight: 19 }, recipeTitle: { color: colors.greenDark, fontSize: 24, fontWeight: '800' },
  meta: { color: colors.muted }, heading: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 6 }, body: { color: colors.ink, lineHeight: 22 },
});

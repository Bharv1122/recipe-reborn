import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { getRecipe } from '@/services/recipes';
import type { Recipe } from '@/types';
import { colors } from '@/theme';

function parseArray(value: string): string[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [value]; }
  catch { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) getRecipe(id).then((data) => setRecipe(data.recipe)).catch((value) => setError(value.message)); }, [id]);
  const ingredients = useMemo(() => recipe ? parseArray(recipe.freshIngredients) : [], [recipe]);
  const instructions = useMemo(() => recipe ? parseArray(recipe.instructions) : [], [recipe]);

  const remove = () => Alert.alert('Delete recipe?', 'This removes the saved recipe and its collection/meal-plan links.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await apiRequest(`/api/mobile/recipes/${id}`, { method: 'DELETE' }); router.back(); }
      catch (value) { setError(value instanceof Error ? value.message : 'Could not delete recipe.'); }
    } },
  ]);

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipe?.title || 'Recipe', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <InlineError message={error} />
      {recipe ? <Card>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.meta}>{[recipe.prepTime, recipe.cookTime, recipe.servings && `${recipe.servings} servings`].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.heading}>Fresh ingredients</Text>
        {ingredients.map((item, index) => <Text key={`${item}-${index}`} style={styles.body}>• {item}</Text>)}
        <Text style={styles.heading}>Instructions</Text>
        {instructions.map((item, index) => <Text key={`${index}-${item}`} style={styles.body}>{index + 1}. {item}</Text>)}
        <Button label="Add to collection" secondary onPress={() => router.push({ pathname: '/collections', params: { recipeId: recipe.id } })} />
        <Button label="Add to meal plan" secondary onPress={() => router.push({ pathname: '/meal-plans', params: { recipeId: recipe.id } })} />
        <Button label="Delete saved recipe" secondary onPress={remove} />
      </Card> : <Text style={styles.meta}>Loading recipe…</Text>}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, title: { color: colors.greenDark, fontSize: 25, fontWeight: '800' },
  meta: { color: colors.muted }, heading: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 8 }, body: { color: colors.ink, lineHeight: 22 },
});

import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { listRecipes } from '@/services/recipes';
import { apiRequest } from '@/services/api';
import type { RecipeSummary } from '@/types';
import { colors } from '@/theme';

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removalLock = useRef(false);
  const loadRevision = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (removalLock.current) return;
    const revision = ++loadRevision.current;
    setLoading(true); setError(null);
    try { const result = await listRecipes(); if (revision === loadRevision.current) { setRecipes(result.recipes); setLoaded(true); } }
    catch (value) { if (revision === loadRevision.current) setError(value instanceof Error ? value.message : 'Could not load recipes.'); }
    finally { if (revision === loadRevision.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const removeRecipe = async (id: string) => {
    if (removalLock.current || loading) return;
    removalLock.current = true; loadRevision.current += 1; setRemovingId(id); setError(null);
    try {
      await apiRequest('/api/mobile/recipes/' + encodeURIComponent(id), { method: 'DELETE' });
      setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not remove the recipe. Please try again.'); }
    finally { removalLock.current = false; setRemovingId(null); }
  };
  const confirmRemove = (recipe: RecipeSummary) => {
    if (removalLock.current || loading) return;
    Alert.alert(
      'Delete from My recipes?',
      `${recipe.title}\n\nThe recipe stays in meal plans and collections that already use it.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void removeRecipe(recipe.id); } }],
    );
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'My recipes', headerTintColor: colors.green, headerStyle: { backgroundColor: colors.white } }} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} enabled={removingId === null} onRefresh={load} />}>
      <InlineError message={error} />{error ? <Button label="Retry loading recipes" secondary disabled={Boolean(removingId)} onPress={load} /> : null}
      <Button label="Plan my meals" secondary onPress={() => router.push('/(tabs)/plans')} />
      {loaded && !loading && !error && !recipes.length ? <Card><Text style={styles.title}>Your recipes will live here</Text><Text style={styles.body}>Make your first recipe, then save it to cook again.</Text><Button label="Make my first recipe" onPress={() => router.push('/generate')} /></Card> : null}
      {recipes.map((recipe) => <Card key={recipe.id}>
        <Pressable accessibilityRole="button" accessibilityLabel={recipe.title} accessibilityHint="Opens the saved recipe" disabled={removingId !== null} style={styles.openRecipe} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.body}>{[recipe.prepTime, recipe.cookTime, recipe.servings && `${recipe.servings} servings`].filter(Boolean).join(' · ') || 'Open recipe'}</Text>
          {recipe.usedInMealPlans ? <Text style={styles.plan}>Used in a meal plan</Text> : null}
          {recipe.dietaryTags.length ? <Text style={styles.tags}>{recipe.dietaryTags.join(' · ')}</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${recipe.title} from My recipes`} disabled={loading || removingId !== null} onPress={() => confirmRemove(recipe)} style={styles.deleteButton}><Text style={styles.deleteText}>{removingId === recipe.id ? 'Removing…' : 'Delete'}</Text></Pressable>
      </Card>)}
      {recipes.length ? <Button label="Organize into collections" secondary onPress={() => router.push('/collections')} /> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  body: { color: colors.muted }, tags: { color: colors.green, fontWeight: '700' }, plan: { color: colors.greenDark, fontSize: 13, fontWeight: '700' },
  openRecipe: { gap: 12, minHeight: 48 }, deleteButton: { minHeight: 48, minWidth: 64, paddingHorizontal: 12, alignSelf: 'flex-end', justifyContent: 'center', alignItems: 'center' }, deleteText: { color: '#A32A1D', fontWeight: '700' },
});

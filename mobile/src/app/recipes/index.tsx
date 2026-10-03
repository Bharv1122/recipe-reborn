import { useCallback, useState } from 'react';
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
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRecipes((await listRecipes()).recipes); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load recipes.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const toggle = (id: string) => setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const removeSelected = async () => {
    if (!selectedIds.size || loading) return;
    setLoading(true); setError(null);
    try {
      await apiRequest('/api/recipes/library', { method: 'PATCH', body: JSON.stringify({ recipeIds: [...selectedIds], action: 'remove' }) });
      setRecipes((current) => current.filter((recipe) => !selectedIds.has(recipe.id)));
      setSelectedIds(new Set()); setManaging(false);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not remove selected recipes.'); }
    finally { setLoading(false); }
  };
  const confirmRemoveSelected = () => {
    if (!selectedIds.size || loading) return;
    Alert.alert(
      'Remove from My recipes?',
      'Meal plans and collections that already use these recipes will be kept.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void removeSelected(); } }],
    );
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'My recipes', headerTintColor: colors.green, headerStyle: { backgroundColor: colors.white } }} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <InlineError message={error} />
      <Button label="Plan my meals" secondary onPress={() => router.push('/meal-plans')} />
      {recipes.length ? <Button label={managing ? 'Done managing' : 'Select recipes to remove'} secondary onPress={() => { setManaging((value) => !value); setSelectedIds(new Set()); }} /> : null}
      {managing ? <Card><Text style={styles.body}>Removing from My recipes keeps meals and collections that already use the recipe.</Text><Button label={`Remove selected (${selectedIds.size})`} onPress={confirmRemoveSelected} disabled={!selectedIds.size} loading={loading} /></Card> : null}
      {!loading && !recipes.length ? <Card><Text style={styles.title}>Your recipes will live here</Text><Text style={styles.body}>Make your first recipe, then save it to cook again.</Text><Button label="Make my first recipe" onPress={() => router.push('/generate')} /></Card> : null}
      {recipes.map((recipe) => <Pressable accessibilityRole={managing ? 'checkbox' : 'button'} accessibilityState={managing ? { checked: selectedIds.has(recipe.id) } : undefined} accessibilityLabel={recipe.title} accessibilityHint={managing ? 'Selects this saved recipe for removal' : 'Opens the saved recipe'} key={recipe.id} onPress={() => managing ? toggle(recipe.id) : router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })}>
        <Card>
          <Text style={styles.title}>{recipe.title}</Text>
          {managing ? <Text style={styles.selected}>{selectedIds.has(recipe.id) ? 'Selected' : 'Tap to select'}</Text> : null}
          <Text style={styles.body}>{[recipe.prepTime, recipe.cookTime, recipe.servings && `${recipe.servings} servings`].filter(Boolean).join(' · ') || 'Open recipe'}</Text>
          {recipe.usedInMealPlans ? <Text style={styles.plan}>Used in a meal plan</Text> : null}
          {recipe.dietaryTags.length ? <Text style={styles.tags}>{recipe.dietaryTags.join(' · ')}</Text> : null}
        </Card>
      </Pressable>)}
      {recipes.length ? <Button label="Organize into collections" secondary onPress={() => router.push('/collections')} /> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  body: { color: colors.muted }, tags: { color: colors.green, fontWeight: '700' }, selected: { color: colors.green, fontWeight: '800' }, plan: { color: colors.greenDark, fontSize: 13, fontWeight: '700' },
});

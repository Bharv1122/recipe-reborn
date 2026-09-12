import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { listRecipes } from '@/services/recipes';
import type { RecipeSummary } from '@/types';
import { colors } from '@/theme';

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRecipes((await listRecipes()).recipes); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load recipes.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'My recipes', headerTintColor: colors.green, headerStyle: { backgroundColor: colors.white } }} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <InlineError message={error} />
      <Button label="Plan my meals" secondary onPress={() => router.push('/meal-plans')} />
      {!loading && !recipes.length ? <Card><Text style={styles.title}>Your recipes will live here</Text><Text style={styles.body}>Make your first recipe, then save it to cook again.</Text><Button label="Make my first recipe" onPress={() => router.push('/generate')} /></Card> : null}
      {recipes.map((recipe) => <Pressable accessibilityRole="button" accessibilityLabel={recipe.title} accessibilityHint="Opens the saved recipe" key={recipe.id} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })}>
        <Card>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.body}>{[recipe.prepTime, recipe.cookTime, recipe.servings && `${recipe.servings} servings`].filter(Boolean).join(' · ') || 'Open recipe'}</Text>
          {recipe.dietaryTags.length ? <Text style={styles.tags}>{recipe.dietaryTags.join(' · ')}</Text> : null}
        </Card>
      </Pressable>)}
      {recipes.length ? <Button label="Organize into collections" secondary onPress={() => router.push('/collections')} /> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  body: { color: colors.muted }, tags: { color: colors.green, fontWeight: '700' },
});

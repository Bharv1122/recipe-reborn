import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Detail { id: string; name: string; description: string | null; collectionRecipes: { id: string; recipe: { id: string; title: string; prepTime: string | null; cookTime: string | null } }[] }

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) apiRequest<{ collection: Detail }>(`/api/mobile/collections/${id}`).then((data) => setDetail(data.collection)).catch((value) => setError(value.message)); }, [id]);
  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: detail?.name || 'Collection', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <InlineError message={error} />
      {detail?.description ? <Text style={styles.body}>{detail.description}</Text> : null}
      {detail?.collectionRecipes.map(({ id: entryId, recipe }) => <Pressable key={entryId} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })}>
        <Card><Text style={styles.title}>{recipe.title}</Text><Text style={styles.body}>{[recipe.prepTime, recipe.cookTime].filter(Boolean).join(' · ')}</Text></Card>
      </Pressable>)}
      {detail && !detail.collectionRecipes.length ? <Card><Text style={styles.body}>No recipes in this collection yet.</Text></Card> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' }, body: { color: colors.muted } });

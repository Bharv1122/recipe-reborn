import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Collection { id: string; name: string; description: string | null; _count: { collectionRecipes: number } }

export default function CollectionsScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setCollections((await apiRequest<{ collections: Collection[] }>('/api/mobile/collections')).collections); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load collections.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) return;
    try {
      await apiRequest('/api/mobile/collections', { method: 'POST', body: JSON.stringify({ name }) });
      setName(''); await load();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not create collection.'); }
  };

  const choose = async (collection: Collection) => {
    if (!recipeId) {
      router.push({ pathname: '/collections/[id]', params: { id: collection.id } });
      return;
    }
    try {
      await apiRequest(`/api/mobile/collections/${collection.id}/recipes`, {
        method: 'POST', body: JSON.stringify({ recipeId }),
      });
      setMessage(`Added to ${collection.name}.`);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not add recipe.'); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipeId ? 'Choose collection' : 'Collections', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Field placeholder="New collection name" value={name} onChangeText={setName} />
        <Button label="Create collection" onPress={create} disabled={!name.trim()} />
      </Card>
      <InlineError message={error} />
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {collections.map((collection) => <Pressable key={collection.id} onPress={() => choose(collection)}>
        <Card>
          <Text style={styles.title}>{collection.name}</Text>
          <Text style={styles.body}>{collection._count.collectionRecipes} recipes{collection.description ? ` · ${collection.description}` : ''}</Text>
        </Card>
      </Pressable>)}
      {!collections.length ? <Text style={styles.body}>Create your first collection above.</Text> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' }, body: { color: colors.muted }, success: { color: colors.green, fontWeight: '800' } });

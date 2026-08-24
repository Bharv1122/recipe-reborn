import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { fetchAndCacheShoppingLists, flushShoppingToggleQueue, queueShoppingToggle, readCachedShoppingLists } from '@/services/shopping-cache';
import type { ShoppingList } from '@/types';
import { Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function ShoppingScreen() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      const cached = await readCachedShoppingLists(db);
      if (cached.length) setLists(cached);
      const network = await Network.getNetworkStateAsync();
      const connected = network.isConnected !== false && network.isInternetReachable !== false;
      setOffline(!connected);
      if (connected) {
        await flushShoppingToggleQueue(db);
        setLists(await fetchAndCacheShoppingLists(db));
      }
    } catch (value) {
      setOffline(true);
      setError(value instanceof Error ? value.message : 'Could not refresh lists. Cached lists are still available.');
    } finally { setRefreshing(false); }
  }, [db]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const toggle = async (listId: string, itemId: string, checked: boolean) => {
    await queueShoppingToggle(db, listId, itemId, checked);
    setLists(await readCachedShoppingLists(db));
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== false && network.isInternetReachable !== false) {
        await flushShoppingToggleQueue(db);
      } else setOffline(true);
    } catch { setOffline(true); }
  };

  return <Screen>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}>
      {offline ? <Text style={styles.offline}>Offline — changes will sync automatically next time this screen opens online.</Text> : null}
      <InlineError message={error} />
      {!lists.length && !refreshing ? <Card><Text style={styles.title}>No shopping lists yet</Text><Text style={styles.body}>Create a list on Recipe Reborn. Native list creation is the next shopping milestone.</Text></Card> : null}
      {lists.map((list) => <Card key={list.id}>
        <Text style={styles.title}>{list.name}</Text>
        {!list.items.length ? <Text style={styles.body}>This list is empty.</Text> : null}
        {list.items.map((item) => <Pressable key={item.id} onPress={() => toggle(list.id, item.id, !item.checked)} style={styles.item} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }}>
          <View style={[styles.checkbox, item.checked && styles.checked]}><Text style={styles.check}>{item.checked ? '✓' : ''}</Text></View>
          <Text style={[styles.itemText, item.checked && styles.itemDone]}>{[item.quantity, item.unit, item.ingredient].filter(Boolean).join(' ')}</Text>
        </Pressable>)}
      </Card>)}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, offline: { color: colors.warning, backgroundColor: '#FFF3C4', borderRadius: 10, padding: 10, fontWeight: '700' },
  title: { fontSize: 19, fontWeight: '800', color: colors.ink }, body: { color: colors.muted },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.green }, check: { color: colors.white, fontWeight: '900' },
  itemText: { color: colors.ink, flex: 1, fontSize: 16 }, itemDone: { color: colors.muted, textDecorationLine: 'line-through' },
});

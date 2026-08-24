import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, apiResponse } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

type Location = 'fridge' | 'pantry' | 'unknown';
type DraftItem = { name: string; quantity: string | null; location: Location; confidence?: 'high' | 'medium' | 'low' };
type PendingPhoto = { uri: string; location: Location };

export default function PantryReviewScreen() {
  const params = useLocalSearchParams<{ uri?: string; location?: string }>();
  const initialPhotos = useMemo<PendingPhoto[]>(() => params.uri ? [{
    uri: params.uri,
    location: params.location === 'fridge' || params.location === 'pantry' ? params.location : 'unknown',
  }] : [], [params.location, params.uri]);
  const [photos, setPhotos] = useState(initialPhotos);
  const [defaultLocation, setDefaultLocation] = useState<Location>('fridge');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePhotos = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, 4 - photos.length), quality: 0.7 });
    if (!result.canceled) setPhotos((current) => [...current, ...result.assets.map((asset) => ({ uri: asset.uri, location: defaultLocation }))].slice(0, 4));
  };

  const extract = async () => {
    if (!photos.length) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const form = new FormData();
      photos.forEach((photo, index) => {
        form.append('images', { uri: photo.uri, name: `inventory-${index + 1}.jpg`, type: 'image/jpeg' } as unknown as Blob);
        form.append('locations', photo.location);
      });
      const response = await apiResponse('/api/pantry-inventory/extract', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not analyze those photos.');
      if (!data.requiresReview) throw new Error('The server did not require review. Nothing was saved.');
      setItems(data.items || []); setNotes(data.reviewNotes || []);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not analyze those photos.'); }
    finally { setBusy(false); }
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeItem = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const save = async () => {
    const confirmed = items.map(({ name, quantity, location }) => ({ name: name.trim(), quantity: quantity?.trim() || null, location })).filter((item) => item.name);
    if (!confirmed.length) return setError('Keep or add at least one item before saving.');
    setBusy(true); setError(null);
    try {
      await apiRequest('/api/pantry-inventory', { method: 'PUT', body: JSON.stringify({ items: confirmed, reviewConfirmed: true }) });
      setSaved(true);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save the confirmed inventory.'); }
    finally { setBusy(false); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Review pantry inventory', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>1. Add up to four photos</Text>
        <Text style={styles.body}>Choose the location before adding each batch. Photos are analyzed for this request and are not stored by Recipe Reborn.</Text>
        <View style={styles.row}>{(['fridge', 'pantry', 'unknown'] as Location[]).map((location) => <Pressable key={location} onPress={() => setDefaultLocation(location)} style={[styles.pill, defaultLocation === location && styles.pillActive]}><Text style={defaultLocation === location ? styles.pillActiveText : styles.pillText}>{location}</Text></Pressable>)}</View>
        <View style={styles.photos}>{photos.map((photo, index) => <Pressable key={`${photo.uri}-${index}`} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}><Image source={{ uri: photo.uri }} style={styles.photo} /><Text style={styles.remove}>Remove</Text></Pressable>)}</View>
        <Button label="Choose photos" secondary onPress={choosePhotos} disabled={photos.length >= 4 || busy} />
        <Button label="Extract draft list" onPress={extract} loading={busy} disabled={!photos.length} />
      </Card>
      <InlineError message={error} />
      {items.length ? <Card>
        <Text style={styles.title}>2. Correct every item</Text>
        <Text style={styles.body}>AI can miss items or read them incorrectly. Edit, remove, or add items before confirming.</Text>
        {notes.map((note) => <Text key={note} style={styles.note}>Review note: {note}</Text>)}
        {items.map((item, index) => <View key={`${index}-${item.name}`} style={styles.item}>
          <Field value={item.name} onChangeText={(name) => updateItem(index, { name })} placeholder="Item name" />
          <Field value={item.quantity || ''} onChangeText={(quantity) => updateItem(index, { quantity })} placeholder="Quantity (optional)" />
          <View style={styles.row}>{(['fridge', 'pantry', 'unknown'] as Location[]).map((location) => <Pressable key={location} onPress={() => updateItem(index, { location })} style={[styles.pill, item.location === location && styles.pillActive]}><Text style={item.location === location ? styles.pillActiveText : styles.pillText}>{location}</Text></Pressable>)}</View>
          {item.confidence ? <Text style={styles.body}>AI confidence: {item.confidence}</Text> : null}
          <Button label="Remove item" secondary onPress={() => removeItem(index)} />
        </View>)}
        <Button label="Add item" secondary onPress={() => setItems((current) => [...current, { name: '', quantity: null, location: 'unknown' }])} />
        <Button label={saved ? 'Inventory saved' : 'Confirm and save inventory'} onPress={save} loading={busy} disabled={saved} />
      </Card> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, title: { fontSize: 20, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pill: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.white },
  pillActive: { backgroundColor: colors.green, borderColor: colors.green }, pillText: { color: colors.ink, textTransform: 'capitalize' }, pillActiveText: { color: colors.white, textTransform: 'capitalize', fontWeight: '700' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, photo: { width: 92, height: 92, borderRadius: 10 }, remove: { color: colors.danger, textAlign: 'center', marginTop: 3 },
  item: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }, note: { color: colors.warning, fontWeight: '700' },
});

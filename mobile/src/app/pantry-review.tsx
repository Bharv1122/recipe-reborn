import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { stageScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import { preparePhotoUpload, removeUploadCopy } from '@/services/photo-upload';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, apiResponse } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

type Location = 'fridge' | 'pantry' | 'unknown';
type DraftItem = { name: string; quantity: string | null; location: Location; confidence?: 'high' | 'medium' | 'low' };
type PendingPhoto = { uri: string; location: Location };

export default function PantryReviewScreen() {
  const router = useRouter();
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
  const [reviewed, setReviewed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhotos = async (camera: boolean) => {
    if (busy || photos.length >= 4) return;
    setError(null); setBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access is off. Enable it in your phone settings, or choose a saved photo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.7 });
      if (!result.canceled) setPhotos((current) => [...current, ...result.assets.map((asset) => ({ uri: asset.uri, location: defaultLocation }))].slice(0, 4));
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not open your photos. Please try again.'); }
    finally { setBusy(false); }
  };

  const extract = async () => {
    if (!photos.length) return;
    setBusy(true); setError(null); setSaved(false);
    const uploadCopies: File[] = [];
    try {
      const form = new FormData();
      for (const photo of photos) {
        const file = await preparePhotoUpload(photo.uri);
        uploadCopies.push(file);
        form.append('images', file);
        form.append('locations', photo.location);
      }
      const response = await apiResponse('/api/pantry-inventory/extract', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (response.status === 422) { setItems([]); setNotes([]); setReviewed(true); return; }
      if (!response.ok) throw new Error(data.error || 'Could not analyze those photos.');
      if (!data.requiresReview) throw new Error('The server did not require review. Nothing was saved.');
      setItems(data.items || []); setNotes(data.reviewNotes || []); setReviewed(true);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not analyze those photos.'); }
    finally { uploadCopies.forEach(removeUploadCopy); setBusy(false); }
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => { setSaved(false); setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); };
  const removeItem = (index: number) => { setSaved(false); setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); };

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
    <Stack.Screen options={{ headerShown: true, title: 'Ingredients from a photo', headerTintColor: colors.green }} />
    <ScrollView key={reviewed ? 'review' : 'photos'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!reviewed ? <Card>
        <Text style={styles.title}>Photograph your fridge or pantry</Text>
        <Text style={styles.body}>We’ll list the ingredients we can see. Add up to four clear photos, then check your list.</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>{(['fridge', 'pantry'] as Location[]).map((location) => <Pressable disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: defaultLocation === location }} key={location} onPress={() => setDefaultLocation(location)} style={[styles.pill, defaultLocation === location && styles.pillActive]}><Text style={defaultLocation === location ? styles.pillActiveText : styles.pillText}>{location}</Text></Pressable>)}</View>
        <View style={styles.photos}>{photos.map((photo, index) => <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove ${photo.location} photo ${index + 1}`} key={`${photo.uri}-${index}`} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}><Image accessible={false} source={{ uri: photo.uri }} style={styles.photo} /><Text style={styles.remove}>Remove</Text></Pressable>)}</View>
        {photos.length ? <Button label={`List ingredients from ${photos.length === 1 ? 'this photo' : 'these photos'}`} onPress={extract} loading={busy} /> : null}
        <Button label={`Take a ${defaultLocation} photo`} secondary={photos.length > 0} onPress={() => addPhotos(true)} disabled={photos.length >= 4 || busy} />
        <Button label="Choose saved photos" secondary onPress={() => addPhotos(false)} disabled={photos.length >= 4 || busy} />
        <Text style={styles.body}>Photos are analyzed for this request and are not stored by Recipe Reborn.</Text>
      </Card> : null}
      <InlineError message={error} />
      {reviewed ? <Card>
        <Text style={styles.title}>Check your ingredients</Text>
        <Text style={styles.body}>{items.length ? 'Check the names and remove anything we got wrong. Then use your list to make a recipe.' : 'We couldn’t identify ingredients in these photos. Add them below, or try a clearer photo.'}</Text>
        {notes.map((note) => <Text key={note} style={styles.note}>Review note: {note}</Text>)}
        {items.map((item, index) => <View key={index} style={styles.item}>
          <View style={styles.itemName}><Field style={styles.nameField} editable={!busy} accessibilityLabel={`Item ${index + 1} name`} value={item.name} onChangeText={(name) => updateItem(index, { name })} placeholder="Item name" /><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove item ${index + 1}`} onPress={() => removeItem(index)} style={styles.removeButton}><Text style={styles.remove}>Remove</Text></Pressable></View>
          {!showDetails && item.quantity ? <Text style={styles.body}>{item.quantity} · {item.location === 'unknown' ? 'Location not identified' : item.location}</Text> : null}
          {item.confidence === 'low' ? <Text style={styles.note}>Please double-check this item.</Text> : null}
          {showDetails ? <>
            <Field editable={!busy} accessibilityLabel={`Item ${index + 1} quantity`} value={item.quantity || ''} onChangeText={(quantity) => updateItem(index, { quantity })} placeholder="Quantity (optional)" />
            <View accessibilityRole="radiogroup" style={styles.row}>{(['fridge', 'pantry', 'unknown'] as Location[]).map((location) => <Pressable disabled={busy} accessibilityLabel={`${location} location for item ${index + 1}`} accessibilityRole="radio" accessibilityState={{ checked: item.location === location }} key={location} onPress={() => updateItem(index, { location })} style={[styles.pill, item.location === location && styles.pillActive]}><Text style={item.location === location ? styles.pillActiveText : styles.pillText}>{location === 'unknown' ? 'Not sure' : location}</Text></Pressable>)}</View>
          </> : null}
        </View>)}
        <Button label="Add an ingredient" disabled={busy} secondary onPress={() => { setSaved(false); setItems((current) => [...current, { name: '', quantity: null, location: defaultLocation }]); }} />
        <Button label="Use these ingredients" disabled={busy || !items.some((item) => item.name.trim())} onPress={() => {
          stageScanRecipeHandoff({ source: 'pantry', origin: 'pantry-photo', ingredients: items.filter((item) => item.name.trim()).map((item) => [item.quantity, item.name.trim()].filter(Boolean).join(' ')).join(', '), context: 'Ingredients you reviewed from your photos' });
          router.replace({ pathname: '/generate', params: { source: 'pantry' } });
        }} />
        {items.length ? <Button label={showOptions ? 'Fewer options' : 'More options'} secondary disabled={busy} onPress={() => setShowOptions(!showOptions)} /> : null}
        {showOptions && items.length ? <>
          <Button label={showDetails ? 'Hide quantities and locations' : 'Edit quantities and locations'} secondary disabled={busy} onPress={() => setShowDetails(!showDetails)} />
          <Button label={saved ? 'Pantry list saved' : 'Save this pantry list (optional)'} secondary onPress={save} loading={busy} disabled={saved} />
        </> : null}
        {showOptions || !items.length ? <Button label="Try different photos" secondary disabled={busy} onPress={() => { setItems([]); setPhotos([]); setReviewed(false); setSaved(false); setShowOptions(false); setShowDetails(false); setError(null); }} /> : null}
      </Card> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, title: { fontSize: 20, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pill: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.white },
  pillActive: { backgroundColor: colors.green, borderColor: colors.green }, pillText: { color: colors.ink, textTransform: 'capitalize' }, pillActiveText: { color: colors.white, textTransform: 'capitalize', fontWeight: '700' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, photo: { width: 92, height: 92, borderRadius: 10 }, remove: { color: colors.danger, textAlign: 'center', marginTop: 3 },
  item: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }, note: { color: colors.warning, fontWeight: '700' },
  itemName: { flexDirection: 'row', alignItems: 'center', gap: 8 }, nameField: { flex: 1 }, removeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});

import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { preparePhotoUpload, removeUploadCopy } from '@/services/photo-upload';
import { adaptImportedDraft, importDraft, saveImportPayload, type ImportAdaptationAction, type ImportDraft } from '@/services/recipe-import';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

type Source = 'photo' | 'file' | 'url';
type Attachment = { uri: string; name: string; size: number; image: boolean; temporary: boolean };
export default function ImportRecipeScreen() {
  const router = useRouter();
  const { user, refreshAccount } = useAuth();
  const [source, setSource] = useState<Source>('photo');
  const [url, setUrl] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [sourceDraft, setSourceDraft] = useState<ImportDraft | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [substitute, setSubstitute] = useState('');
  const [oneRecipeDiet, setOneRecipeDiet] = useState('');
  const [adaptationNotes, setAdaptationNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const temporary = useRef<string | null>(null);
  useEffect(() => () => {
    abort.current?.abort();
    if (temporary.current) removeUploadCopy(new File(temporary.current));
  }, []);
  useEffect(() => { refreshAccount().catch(() => undefined); }, [refreshAccount]);
  const clearAttachment = () => {
    if (temporary.current) removeUploadCopy(new File(temporary.current));
    temporary.current = null; setAttachment(null);
  };
  const selectSource = (next: Source) => {
    if (busyRef.current) return;
    clearAttachment(); setSource(next); setDraft(null); setSourceDraft(null); setError(null);
  };
  const choosePhoto = async (camera: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        throw new Error('Camera access is off. Allow it in device Settings, or choose an existing photo.');
      }
      if (!camera && !(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) {
        throw new Error('Photo access is off. Allow it in device Settings, or take a new photo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
      if (result.canceled) return;
      const photo = await preparePhotoUpload(result.assets[0].uri);
      clearAttachment(); temporary.current = photo.uri;
      setAttachment({ uri: photo.uri, name: 'recipe-photo.jpg', size: photo.size, image: true, temporary: true });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not select a recipe photo.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const chooseFile = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/markdown', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      const image = /\.(jpe?g|png|webp)$/i.test(asset.name);
      const pdf = /\.pdf$/i.test(asset.name);
      if (!image && !pdf && !/\.(txt|md)$/i.test(asset.name)) {
        removeUploadCopy(file); throw new Error('Choose JPG, PNG, WebP, PDF, TXT, or Markdown. Word files are not supported.');
      }
      const limit = image || pdf ? 3 * 1024 * 1024 : 100 * 1024;
      if (!file.size || file.size > limit) {
        removeUploadCopy(file); throw new Error(image || pdf ? 'Choose an image or PDF smaller than 3 MB.' : 'Choose a text file smaller than 100 KB.');
      }
      clearAttachment(); temporary.current = file.uri;
      setAttachment({ uri: file.uri, name: asset.name, size: file.size, image, temporary: true });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not open that file.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const extract = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      let body: string | FormData;
      if (source === 'url') {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'https:') throw new Error('Enter a secure https recipe link.');
        body = JSON.stringify({ url: parsed.href });
      } else {
        if (!attachment) throw new Error('Choose a recipe photo or file first.');
        const form = new FormData();
        form.append('file', new File(attachment.uri), attachment.name);
        body = form;
      }
      const result = await apiRequest<{ recipe: unknown }>('/api/import-recipe', { method: 'POST', body, signal: controller.signal });
      if (!controller.signal.aborted) {
        const imported = importDraft(result.recipe);
        setDraft(imported); setSourceDraft(imported);
        setSelectedIngredient(imported.ingredients.split(/\r?\n/).find(Boolean) || '');
        setAdaptationNotes(imported.reviewNotes);
      }
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Could not read that recipe.');
    } finally { abort.current = null; busyRef.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!draft || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const payload = saveImportPayload(draft, sourceDraft ?? draft);
      const result = await apiRequest<{ recipe: { id: string } }>('/api/mobile/recipes', { method: 'POST', body: JSON.stringify(payload) });
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save. Your edits are still here.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const adapt = async (action: ImportAdaptationAction) => {
    if (!draft || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      const result = await adaptImportedDraft(draft, action, controller.signal);
      if (controller.signal.aborted) return;
      const adapted = importDraft(result.recipe);
      setDraft(adapted);
      setSelectedIngredient(adapted.ingredients.split(/\r?\n/).find(Boolean) || '');
      setSubstitute('');
      setAdaptationNotes([result.changeSummary, ...result.reviewNotes].filter(Boolean).join('\n'));
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'The recipe could not be adapted. Your draft is unchanged.');
    } finally { if (abort.current === controller) abort.current = null; busyRef.current = false; setBusy(false); }
  };
  const edit = (key: keyof ImportDraft, value: string) => setDraft(current => current ? { ...current, [key]: value } : null);
  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: draft ? 'Review imported recipe' : 'Import a recipe', headerTintColor: colors.green }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {draft ? <Card>
        <Text style={styles.title}>Check before saving</Text>
        <Text style={styles.body}>Compare the extracted recipe with your source. Correct anything missing or misread. Nothing is saved until you choose Save.</Text>
        {adaptationNotes ? <Text accessibilityLiveRegion="polite" style={styles.warning}>Needs your review: {adaptationNotes}</Text> : null}
        {(['title', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servings', 'dietaryTags'] as const).map(key => {
          const label = { title: 'Recipe title', ingredients: 'Ingredients (one per line)', instructions: 'Instructions (one step per line)', prepTime: 'Prep time', cookTime: 'Cook time', servings: 'Servings', dietaryTags: 'Dietary tags (comma separated)' }[key];
          const multiline = key === 'ingredients' || key === 'instructions';
          return <View key={key} style={styles.group}><Text style={styles.label}>{label}</Text><Field accessibilityLabel={label} value={draft[key]} onChangeText={value => edit(key, value)} editable={!busy} multiline={multiline} style={multiline ? styles.multiline : undefined} /></View>;
        })}
        <View style={styles.adaptBox}>
          <Text style={styles.titleSmall}>Adapt this imported recipe</Text>
          <Text style={styles.body}>Choose an ingredient below, then substitute or remove it. Ingredients, directions, quantities, and times update together only after a coherent result succeeds.</Text>
          {draft.ingredients.split(/\r?\n/).map(item => item.trim()).filter(Boolean).map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedIngredient === item }} key={item} onPress={() => setSelectedIngredient(item)} style={[styles.ingredientChoice, selectedIngredient === item && styles.ingredientSelected]}><Text style={styles.body}>{selectedIngredient === item ? 'Selected: ' : ''}{item}</Text></Pressable>)}
          <Field accessibilityLabel="Substitute ingredient" value={substitute} onChangeText={setSubstitute} placeholder="Substitute with…" editable={!busy} />
          <Button label="Substitute selected ingredient" disabled={!selectedIngredient || !substitute.trim()} loading={busy} onPress={() => void adapt({ type: 'substitute', original: selectedIngredient, substitute: substitute.trim() })} />
          <Button label="Remove selected ingredient" secondary disabled={!selectedIngredient || busy} onPress={() => void adapt({ type: 'remove', original: selectedIngredient })} />
          <Text style={styles.label}>Apply saved preferences to this recipe only</Text>
          <Text style={styles.body}>Allergies to avoid: {user?.allergies?.join(', ') || 'none saved'}</Text>
          <Text style={styles.body}>Dislikes: {user?.dislikedIngredients?.join(', ') || 'none saved'}</Text>
          <Text style={styles.body}>Likes may guide substitutes: {user?.likedIngredients?.join(', ') || 'none saved'}</Text>
          <Field accessibilityLabel="One-recipe dietary request" value={oneRecipeDiet} onChangeText={setOneRecipeDiet} placeholder="Optional, e.g. vegetarian" editable={!busy} />
          <Button label="Apply my preferences — this recipe only" secondary disabled={busy} onPress={() => void adapt({ type: 'preferences', oneRecipeDiet: oneRecipeDiet.trim() })} />
          {busy ? <Button label="Cancel adaptation" secondary onPress={() => abort.current?.abort()} /> : null}
          <Button label="Revert to imported source" secondary disabled={busy || !sourceDraft} onPress={() => { if (!sourceDraft) return; setDraft(sourceDraft); setSelectedIngredient(sourceDraft.ingredients.split(/\r?\n/).find(Boolean) || ''); setAdaptationNotes('Restored the faithful imported source. Review it before saving.'); }} />
          <Text style={styles.body}>Adaptations do not use another monthly recipe generation. Always review the result and product labels; allergy checks are bounded safeguards, not a medical guarantee.</Text>
        </View>
        <Button label="Save to My recipes" onPress={save} loading={busy} />
        <Button label="Back to source" secondary disabled={busy} onPress={() => { setDraft(null); setError(null); }} />
      </Card> : <>
        <Text style={styles.title}>Bring your recipes with you</Text>
        <Text style={styles.body}>Read a cookbook photo, recipe file, or website. Review and edit the result before saving.</Text>
        <View style={styles.sources}>{(['photo', 'file', 'url'] as const).map(value => <View key={value} style={styles.source}><Button label={{ photo: 'Photo', file: 'File', url: 'Website' }[value]} secondary={source !== value} disabled={busy} onPress={() => selectSource(value)} /></View>)}</View>
        <Card>
          {source === 'url' ? <><Text style={styles.label}>Recipe website link</Text><Field accessibilityLabel="Recipe website link" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} placeholder="https://example.com/recipe" /></> : source === 'photo' ? <><Text style={styles.body}>Photograph the whole recipe, including ingredients and steps.</Text><Button label="Take recipe photo" onPress={() => choosePhoto(true)} disabled={busy} /><Button label="Choose recipe photo" secondary onPress={() => choosePhoto(false)} disabled={busy} /></> : <><Text style={styles.body}>JPG, PNG, WebP, or PDF up to 3 MB; UTF-8 TXT or Markdown up to 100 KB. Word files are not supported.</Text><Button label="Choose recipe file" onPress={chooseFile} disabled={busy} /></>}
          {attachment ? <><Text style={styles.body}>{attachment.name}</Text>{attachment.image ? <Image accessibilityLabel="Selected recipe source" source={{ uri: attachment.uri }} style={styles.preview} resizeMode="contain" /> : null}</> : null}
          <Button label="Read recipe" onPress={extract} loading={busy} disabled={source === 'url' ? !url.trim() : !attachment} />
        </Card>
      </>}
      <InlineError message={error} />
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32 }, title: { fontSize: 24, fontWeight: '800', color: colors.greenDark },
  body: { color: colors.muted, lineHeight: 22 }, label: { color: colors.ink, fontWeight: '700' }, group: { gap: 6 },
  warning: { color: '#8A4B08', backgroundColor: '#FFF4D6', borderRadius: 10, padding: 12, lineHeight: 20 }, titleSmall: { color: colors.greenDark, fontSize: 18, fontWeight: '800' },
  adaptBox: { gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: '#F4FBF6' }, ingredientChoice: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.white }, ingredientSelected: { borderColor: colors.green, backgroundColor: '#EAF7ED' },
  sources: { flexDirection: 'row', gap: 8 }, source: { flex: 1 }, multiline: { minHeight: 140, textAlignVertical: 'top', paddingVertical: 12 }, preview: { width: '100%', height: 220 },
});

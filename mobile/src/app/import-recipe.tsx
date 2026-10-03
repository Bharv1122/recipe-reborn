import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { preparePhotoUpload, removeUploadCopy } from '@/services/photo-upload';
import { importDraft, importSnapshot, saveImportPayload, type ImportDraft } from '@/services/recipe-import';
import { RecipeDetail, type DetailSave } from '@/components/recipe-detail';
import { colors } from '@/theme';
import { takeChefRecipe } from '@/services/chef-recipe-handoff';

type Source = 'photo' | 'file' | 'url';
type Attachment = { uri: string; name: string; size: number; image: boolean; temporary: boolean };
export default function ImportRecipeScreen() {
  const router = useRouter();
  const [source, setSource] = useState<Source>('photo');
  const [url, setUrl] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(() => { const chef = takeChefRecipe(); return chef ? importDraft(chef) : null; });
  const [sourceDraft, setSourceDraft] = useState<ImportDraft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const temporary = useRef<string | null>(null);
  useEffect(() => () => {
    abort.current?.abort();
    if (temporary.current) removeUploadCopy(new File(temporary.current));
  }, []);
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
        importSnapshot(imported);
        setDraft(imported); setSourceDraft(imported);
      }
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Could not read that recipe.');
    } finally { abort.current = null; busyRef.current = false; setBusy(false); }
  };
  const save = async ({ recipe, nutrition, allowLeave }: DetailSave) => {
    if (!draft || busyRef.current) return;
    busyRef.current = true;
    try {
      const payload = { ...saveImportPayload(importDraft(recipe), sourceDraft ?? draft), comparisonSnapshot: { version: 1, source: 'dish', originalNutrition: null, freshNutrition: nutrition } };
      const result = await apiRequest<{ recipe: { id: string } }>('/api/mobile/recipes', { method: 'POST', body: JSON.stringify(payload) });
      allowLeave();
      router.replace({ pathname: '/recipes/[id]', params: { id: result.recipe.id, justSaved: '1' } });
    } finally { busyRef.current = false; }
  };
  if (draft) return <>
    <Stack.Screen options={{ headerShown: true, title: 'Your recipe', headerTintColor: colors.white, headerStyle: { backgroundColor: colors.green } }} />
    <RecipeDetail initial={importSnapshot(draft)} sourceRecipe={sourceDraft ? importSnapshot(sourceDraft) : null} onSave={save}
      intro={<Card><Text style={styles.body}>Compare this recipe with your source before saving. Use Review imported source below to see the extracted original.</Text>{draft.reviewNotes ? <Text style={styles.warning}>Source review notes: {draft.reviewNotes}</Text> : null}</Card>} />
  </>;
  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Import a recipe', headerTintColor: colors.green }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <>
        <Text style={styles.title}>Bring your recipes with you</Text>
        <Text style={styles.body}>Read a cookbook photo, recipe file, or website. Review and edit the result before saving.</Text>
        <View style={styles.sources}>{(['photo', 'file', 'url'] as const).map(value => <View key={value} style={styles.source}><Button label={{ photo: 'Photo', file: 'File', url: 'Website' }[value]} secondary={source !== value} disabled={busy} onPress={() => selectSource(value)} /></View>)}</View>
        <Card>
          {source === 'url' ? <><Text style={styles.label}>Recipe website link</Text><Field accessibilityLabel="Recipe website link" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} placeholder="https://example.com/recipe" /></> : source === 'photo' ? <><Text style={styles.body}>Photograph the whole recipe, including ingredients and steps.</Text><Button label="Take recipe photo" onPress={() => choosePhoto(true)} disabled={busy} /><Button label="Choose recipe photo" secondary onPress={() => choosePhoto(false)} disabled={busy} /></> : <><Text style={styles.body}>JPG, PNG, WebP, or PDF up to 3 MB; UTF-8 TXT or Markdown up to 100 KB. Word files are not supported.</Text><Button label="Choose recipe file" onPress={chooseFile} disabled={busy} /></>}
          {attachment ? <><Text style={styles.body}>{attachment.name}</Text>{attachment.image ? <Image accessibilityLabel="Selected recipe source" source={{ uri: attachment.uri }} style={styles.preview} resizeMode="contain" /> : null}</> : null}
          <Button label="Read recipe" onPress={extract} loading={busy} disabled={source === 'url' ? !url.trim() : !attachment} />
        </Card>
      </>
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

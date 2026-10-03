import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { prepareRecipePhotoUpload, removeUploadCopy } from '@/services/photo-upload';
import { importDraft, importSnapshot, saveImportPayload, type ImportDraft } from '@/services/recipe-import';
import { RecipeDetail, type DetailSave } from '@/components/recipe-detail';
import { colors } from '@/theme';
import { takeChefRecipe } from '@/services/chef-recipe-handoff';
import { stageScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import { MISSING_SOURCE_DIRECTIONS } from '../../../shared/recipe-import';

type Source = 'photo' | 'file' | 'url' | 'text';
type Attachment = { uri: string; name: string; size: number; image: boolean; temporary: boolean };
export default function ImportRecipeScreen() {
  const router = useRouter();
  const [source, setSource] = useState<Source>('photo');
  const [url, setUrl] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [partial, setPartial] = useState<{ title: string; ingredients: string; reviewNotes: string } | null>(null);
  const [directions, setDirections] = useState('');
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
    clearAttachment(); setSource(next); setDraft(null); setSourceDraft(null); setPartial(null); setDirections(''); setError(null);
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
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
      if (result.canceled) return;
      const photo = await prepareRecipePhotoUpload(result.assets[0].uri);
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
      if (source === 'text') {
        body = JSON.stringify({ text: recipeText.trim() });
      } else if (source === 'url') {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'https:') throw new Error('Enter a secure https recipe link.');
        body = JSON.stringify({ url: parsed.href });
      } else {
        if (!attachment) throw new Error('Choose a recipe photo or file first.');
        const form = new FormData();
        form.append('file', new File(attachment.uri), attachment.name);
        body = form;
      }
      const result = await apiRequest<{ status?: string; recipe: { title: string; freshIngredients: string; reviewNotes?: string } }>('/api/import-recipe', { method: 'POST', body, headers: { 'x-recipe-partial-review': '1' }, signal: controller.signal });
      if (!controller.signal.aborted) {
        if (result.status === 'partial') {
          setPartial({ title: result.recipe.title, ingredients: result.recipe.freshIngredients, reviewNotes: result.recipe.reviewNotes || '' });
          setDirections('');
          return;
        }
        const imported = importDraft(result.recipe);
        importSnapshot(imported);
        setDraft(imported); setSourceDraft(imported);
      }
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Could not read that recipe.');
    } finally { abort.current = null; busyRef.current = false; setBusy(false); }
  };
  const rotatePhoto = async () => {
    if (!attachment?.image || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const rotated = await prepareRecipePhotoUpload(attachment.uri, 90);
      clearAttachment(); temporary.current = rotated.uri;
      setAttachment({ uri: rotated.uri, name: 'recipe-photo.jpg', size: rotated.size, image: true, temporary: true });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not rotate photo.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  if (partial) return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Finish your import', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Card>
      <Text style={styles.title}>Ingredients found</Text>
      <Text style={styles.body}>No cooking directions were visible. Your ingredients are preserved; this partial read did not use a recipe import.</Text>
      <Text style={styles.warning}>{partial.reviewNotes}</Text>
      <Field accessibilityLabel="Imported title" value={partial.title} onChangeText={title => setPartial({ ...partial, title })} />
      <Field accessibilityLabel="Imported ingredients" multiline style={styles.multiline} value={partial.ingredients} onChangeText={ingredients => setPartial({ ...partial, ingredients })} />
      <Text style={styles.label}>Add your directions</Text>
      <Field accessibilityLabel="Missing directions" multiline style={styles.multiline} placeholder="Paste or type the cooking steps" value={directions} onChangeText={setDirections} />
      <Button label="Review recipe" disabled={!directions.trim() || !partial.title.trim() || !partial.ingredients.trim()} onPress={() => {
        try {
          const completed = importDraft({ title: partial.title, freshIngredients: partial.ingredients, instructions: directions, reviewNotes: 'Directions added during review; they were not visible in the source.' });
          importSnapshot(completed);
          setSourceDraft({ ...completed, instructions: MISSING_SOURCE_DIRECTIONS });
          setDraft(completed); setPartial(null); setError(null);
        } catch (value) { setError(value instanceof Error ? value.message : 'Check the recipe details.'); }
      }} />
      <Text style={styles.body}>Or create a new recipe with AI-written steps. This uses one recipe generation.</Text>
      <Button label="Create recipe with AI" secondary disabled={!partial.ingredients.trim()} onPress={() => {
        stageScanRecipeHandoff({ source: 'pantry', origin: 'import-ingredients', pantryTargetTitle: partial.title.trim() !== 'Imported recipe' ? partial.title.trim().slice(0, 100) || undefined : undefined, ingredients: partial.ingredients, context: 'Imported ingredients — AI will write a new recipe' });
        router.push('/generate');
      }} />
      <Button label="Choose another source" secondary onPress={() => setPartial(null)} />
      <InlineError message={error} />
    </Card></ScrollView>
  </Screen>;
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
        <View style={styles.sources}>{(['photo', 'file', 'url', 'text'] as const).map(value => <View key={value} style={styles.source}><Button label={{ photo: 'Photo', file: 'File', url: 'Website', text: 'Text' }[value]} secondary={source !== value} disabled={busy} onPress={() => selectSource(value)} /></View>)}</View>
        <InlineError message={error} />
        <Card>
          {source === 'text' ? <><Text style={styles.label}>Recipe text</Text><Field accessibilityLabel="Recipe text" value={recipeText} onChangeText={setRecipeText} multiline style={styles.multiline} editable={!busy} maxLength={100000} placeholder="Paste the ingredients and cooking directions" /></> : source === 'url' ? <><Text style={styles.label}>Recipe website link</Text><Field accessibilityLabel="Recipe website link" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} placeholder="https://example.com/recipe" /><Text style={styles.body}>If the website blocks import, copy its recipe into Text.</Text></> : source === 'photo' ? <><Text style={styles.body}>Choose a recipe photo or screenshot. Include the ingredients and any cooking directions.</Text><Button label="Take recipe photo" onPress={() => choosePhoto(true)} disabled={busy} /><Button label="Choose recipe photo" secondary onPress={() => choosePhoto(false)} disabled={busy} /></> : <><Text style={styles.body}>JPG, PNG, WebP, or PDF up to 3 MB; UTF-8 TXT or Markdown up to 100 KB. Word files are not supported.</Text><Button label="Choose recipe file" onPress={chooseFile} disabled={busy} /></>}
          {attachment ? <><Text style={styles.body}>{attachment.name}</Text>{attachment.image ? <><Image accessibilityLabel="Selected recipe source" source={{ uri: attachment.uri }} style={styles.preview} resizeMode="contain" /><Button label="Rotate photo" secondary disabled={busy} onPress={rotatePhoto} /></> : null}</> : null}
          <Button label="Read recipe" onPress={extract} loading={busy} disabled={source === 'text' ? !recipeText.trim() : source === 'url' ? !url.trim() : !attachment} />
        </Card>
      </>
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32 }, title: { fontSize: 24, fontWeight: '800', color: colors.greenDark },
  body: { color: colors.muted, lineHeight: 22 }, label: { color: colors.ink, fontWeight: '700' }, group: { gap: 6 },
  warning: { color: '#8A4B08', backgroundColor: '#FFF4D6', borderRadius: 10, padding: 12, lineHeight: 20 }, titleSmall: { color: colors.greenDark, fontSize: 18, fontWeight: '800' },
  adaptBox: { gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: '#F4FBF6' }, ingredientChoice: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.white }, ingredientSelected: { borderColor: colors.green, backgroundColor: '#EAF7ED' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, source: { flexGrow: 1, flexBasis: '45%' }, multiline: { minHeight: 140, textAlignVertical: 'top', paddingVertical: 12 }, preview: { width: '100%', height: 320 },
});

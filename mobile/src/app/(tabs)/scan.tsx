import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiRequest, apiResponse } from '@/services/api';
import { makePendingFoodPhoto, type CapturePurpose } from '@/services/camera-inventory';
import { stageScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

type Mode = 'barcode' | CapturePurpose;
type Product = { found: boolean; name: string; ingredients_text: string };

export default function ScanScreen() {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<Mode>('barcode');
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setCameraReady(false);
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const scanBarcode = async ({ data }: BarcodeScanningResult) => {
    if (scanned || busy) return;
    setScanned(true); setBusy(true); setError(null); setProduct(null);
    try { setProduct(await apiRequest<Product>(`/api/mobile/barcode/${encodeURIComponent(data)}`)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Barcode lookup failed.'); }
    finally { setBusy(false); }
  };

  const generateFromBarcode = () => {
    if (!product?.found || !product.ingredients_text.trim()) return;
    stageScanRecipeHandoff({
      source: 'label',
      origin: 'barcode',
      ingredients: product.ingredients_text,
      context: product.name ? `Barcode product: ${product.name}` : 'Ingredients loaded from the scanned barcode',
    });
    router.push('/generate');
  };

  const reviewLabel = async () => {
    if (!photoUri) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('image', { uri: photoUri, name: 'package-label.jpg', type: 'image/jpeg' } as unknown as Blob);
      const response = await apiResponse('/api/extract-recipe-from-photo', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not read that package label.');
      if (data.type !== 'ingredient_list') throw new Error('That photo does not look like a package ingredient label. Try a closer photo of the ingredient list.');
      const ingredients = Array.isArray(data.ingredients)
        ? data.ingredients.map((item: unknown) => String(item).trim()).filter(Boolean).join(', ')
        : '';
      if (!ingredients) throw new Error('No readable ingredients were found. Try a closer, well-lit label photo.');
      stageScanRecipeHandoff({
        source: 'label',
        origin: 'label-photo',
        ingredients,
        context: data.title ? String(data.title) : 'Ingredients extracted from your package-label photo',
      });
      router.push('/generate');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not read that package label.');
    } finally { setBusy(false); }
  };

  const capture = async () => {
    setBusy(true); setError(null);
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.7, exif: false });
      if (picture?.uri) setPhotoUri(makePendingFoodPhoto(picture.uri, mode as CapturePurpose).uri);
    } catch { setError('The photo could not be captured.'); }
    finally { setBusy(false); }
  };

  const allowCamera = async () => {
    setRequestingPermission(true); setError(null);
    try {
      const result = await requestPermission();
      if (!result.granted) {
        setError(result.canAskAgain
          ? 'Camera access was not granted. Tap Allow camera to try again.'
          : 'Camera access is blocked. Enable it for Recipe Reborn in Android Settings.');
      }
    } catch {
      setError('Android could not open the camera permission request.');
    } finally { setRequestingPermission(false); }
  };

  if (!permission) {
    return <Screen><Card><Text style={styles.title}>Checking camera access…</Text></Card></Screen>;
  }

  if (!permission.granted) {
    return <Screen><Card>
      <Text style={styles.title}>Camera access is off</Text>
      <Text style={styles.body}>Recipe Reborn uses the camera only when you choose to scan a barcode, label, refrigerator, or pantry.</Text>
      <Button label="Allow camera" onPress={allowCamera} loading={requestingPermission} />
      <InlineError message={error} />
    </Card></Screen>;
  }

  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.modes}>
        {(['barcode', 'label', 'fridge', 'pantry'] as Mode[]).map((value) =>
          <Pressable key={value} onPress={() => { setMode(value); setScanned(false); setPhotoUri(null); setProduct(null); setError(null); }}
            style={[styles.mode, mode === value && styles.modeActive]}>
            <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value}</Text>
          </Pressable>)}
      </View>

      {focused && !photoUri && !product ? <View style={styles.cameraWrap}>
        <CameraView
          ref={camera}
          style={styles.camera}
          facing="back"
          active={focused}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(event) => setError(event.message || 'The camera preview could not start.')}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'barcode' && !scanned ? scanBarcode : undefined}
        />
        <Text style={styles.guide}>{mode === 'barcode' ? 'Center the barcode in the frame' : `Photograph the ${mode}`}</Text>
      </View> : null}

      {mode !== 'barcode' && !photoUri ? <Button label={cameraReady ? `Take ${mode} photo` : 'Starting camera…'} onPress={capture} loading={busy} disabled={!cameraReady} /> : null}
      {photoUri ? <Card>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        <Text style={styles.title}>Review before anything is saved</Text>
        <Text style={styles.body}>{mode === 'label'
          ? 'Recipe Reborn will read the ingredient list, then require you to correct it before you can generate a recipe.'
          : 'Recipe Reborn will extract a draft list. You can correct every item before confirming the inventory.'}</Text>
        <Button
          label={mode === 'label' ? 'Extract and review ingredients' : 'Extract and review items'}
          onPress={mode === 'label' ? reviewLabel : () => router.push({ pathname: '/pantry-review', params: { uri: photoUri, location: mode } })}
          loading={busy}
        />
        <Button label="Retake" secondary disabled={busy} onPress={() => { setCameraReady(false); setPhotoUri(null); }} />
      </Card> : null}

      <InlineError message={error} />
      {product ? <Card>
        <Text style={styles.title}>{product.found ? (product.name || 'Product found') : 'Barcode not found'}</Text>
        <Text style={styles.body}>{product.found ? (product.ingredients_text || 'No ingredient list was supplied by Open Food Facts.') : 'Try the label-photo mode instead.'}</Text>
        {product.found && product.ingredients_text.trim() ? <Button label="Generate recipe" onPress={generateFromBarcode} /> : null}
        <Button label="Scan another" secondary onPress={() => { setScanned(false); setProduct(null); }} />
      </Card> : null}
      {busy && mode === 'barcode' ? <Text style={styles.status}>Looking up product…</Text> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, modes: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mode: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13 },
  modeActive: { backgroundColor: colors.green, borderColor: colors.green }, modeText: { color: colors.ink, textTransform: 'capitalize', fontWeight: '700' }, modeTextActive: { color: colors.white },
  cameraWrap: { height: 390, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }, camera: { flex: 1 },
  guide: { position: 'absolute', bottom: 16, alignSelf: 'center', color: colors.white, backgroundColor: '#000A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  preview: { width: '100%', height: 240, borderRadius: 12, resizeMode: 'cover' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 }, status: { color: colors.green, fontWeight: '700', textAlign: 'center' },
});

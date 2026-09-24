import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiRequest, apiResponse } from '@/services/api';
import { makePendingFoodPhoto, type CapturePurpose } from '@/services/camera-inventory';
import { stageScanRecipeHandoff } from '@/services/scan-recipe-handoff';
import { preparePhotoUpload, removeUploadCopy } from '@/services/photo-upload';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';
import type { OriginalNutrition } from '../../../../shared/nutrition-facts';

type Mode = 'barcode' | CapturePurpose;
type Product = { found: boolean; name: string; ingredients_text: string; originalNutrition?: OriginalNutrition | null };

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
      originalNutrition: product.originalNutrition,
      ingredients: product.ingredients_text,
      context: product.name ? `Barcode product: ${product.name}` : 'Ingredients loaded from the scanned barcode',
    });
    router.push('/generate');
  };

  const reviewLabel = async () => {
    if (!photoUri) return;
    setBusy(true); setError(null);
    let upload: Awaited<ReturnType<typeof preparePhotoUpload>> | null = null;
    try {
      upload = await preparePhotoUpload(photoUri);
      const form = new FormData();
      form.append('image', upload);
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
        originalNutrition: data.originalNutrition ?? null,
        ingredients,
        context: data.title ? String(data.title) : 'Ingredients extracted from your package-label photo',
      });
      router.push('/generate');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not read that package label.');
    } finally {
      if (upload) removeUploadCopy(upload);
      setBusy(false);
    }
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
          : 'Camera access is blocked. Enable it for Recipe Reborn in your device Settings.');
      }
    } catch {
      setError('The camera permission request could not be opened.');
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
      {!product && !photoUri ? <>
        <Text style={styles.title}>{mode === 'barcode' ? 'Point at the barcode' : 'Photograph the ingredient list'}</Text>
        <Text style={styles.body}>{mode === 'barcode' ? 'Hold the package steady. We will look it up automatically.' : 'Turn the package to its ingredients. Keep the words close, clear and well lit.'}</Text>
      </> : null}

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

      {mode !== 'barcode' && !photoUri ? <Button label={cameraReady ? 'Take ingredient photo' : 'Starting camera…'} onPress={capture} loading={busy} disabled={!cameraReady} /> : null}
      {!product && !photoUri ? <Button label={mode === 'barcode' ? 'No barcode? Photograph the ingredients' : 'Use the barcode instead'} secondary disabled={busy} onPress={() => { setMode(mode === 'barcode' ? 'label' : 'barcode'); setScanned(false); setError(null); }} /> : null}
      {photoUri ? <Card>
        <Image accessibilityLabel={`Preview of captured ${mode} photo`} source={{ uri: photoUri }} style={styles.preview} />
        <Text style={styles.title}>Can you read the ingredients?</Text>
        <Text style={styles.body}>{mode === 'label'
          ? 'If the words are clear, continue. You can correct the ingredient list on the next screen.'
          : 'Recipe Reborn will extract a draft list. You can correct every item before confirming the inventory.'}</Text>
        <Button
          label={mode === 'label' ? 'Read these ingredients' : 'Read these items'}
          onPress={mode === 'label' ? reviewLabel : () => router.push({ pathname: '/pantry-review', params: { uri: photoUri, location: mode } })}
          loading={busy}
        />
        <Button label="Retake" secondary disabled={busy} onPress={() => { setCameraReady(false); setPhotoUri(null); }} />
      </Card> : null}

      <InlineError message={error} />
      {product ? <Card>
        <Text style={styles.title}>{product.found ? (product.name || 'Product found') : 'Barcode not found'}</Text>
        <Text style={styles.body}>{product.found && product.ingredients_text.trim() ? 'We found the ingredients. Check them next, then make your homemade version.' : 'We could not find ingredients for this barcode. Take a photo of the ingredient list instead.'}</Text>
        {product.found && product.ingredients_text.trim() ? <Button label="Review ingredients" onPress={generateFromBarcode} /> : null}
        {(!product.found || !product.ingredients_text.trim()) ? <Button label="Photograph the ingredients" onPress={() => { setMode('label'); setProduct(null); setScanned(false); setCameraReady(false); setError(null); }} /> : null}
        <Button label="Scan another" secondary onPress={() => { setScanned(false); setProduct(null); }} />
      </Card> : null}
      {busy && mode === 'barcode' ? <Text style={styles.status}>Looking up product…</Text> : null}
      {error && mode === 'barcode' && !product ? <Button label="Try barcode again" secondary onPress={() => { setScanned(false); setError(null); }} /> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, modes: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mode: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13 },
  modeActive: { backgroundColor: colors.green, borderColor: colors.green }, modeText: { color: colors.ink, textTransform: 'capitalize', fontWeight: '700' }, modeTextActive: { color: colors.white },
  cameraWrap: { height: 390, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }, camera: { flex: 1 },
  guide: { position: 'absolute', bottom: 16, alignSelf: 'center', color: colors.white, backgroundColor: '#000A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  preview: { width: '100%', height: 240, borderRadius: 12, resizeMode: 'cover' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 }, status: { color: colors.green, fontWeight: '700', textAlign: 'center' },
});

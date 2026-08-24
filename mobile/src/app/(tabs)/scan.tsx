import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { makePendingFoodPhoto, type CapturePurpose } from '@/services/camera-inventory';
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
  const [product, setProduct] = useState<Product | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
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

  const capture = async () => {
    setBusy(true); setError(null);
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.7, exif: false });
      if (picture?.uri) setPhotoUri(makePendingFoodPhoto(picture.uri, mode as CapturePurpose).uri);
    } catch { setError('The photo could not be captured.'); }
    finally { setBusy(false); }
  };

  if (!permission?.granted) {
    return <Screen><Card>
      <Text style={styles.title}>Camera access is off</Text>
      <Text style={styles.body}>Recipe Reborn uses the camera only when you choose to scan a barcode, label, refrigerator, or pantry.</Text>
      <Button label="Allow camera" onPress={requestPermission} />
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

      {focused && !photoUri ? <View style={styles.cameraWrap}>
        <CameraView
          ref={camera}
          style={styles.camera}
          facing="back"
          active={focused}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'barcode' && !scanned ? scanBarcode : undefined}
        />
        <Text style={styles.guide}>{mode === 'barcode' ? 'Center the barcode in the frame' : `Photograph the ${mode}`}</Text>
      </View> : null}

      {mode !== 'barcode' && !photoUri ? <Button label={`Take ${mode} photo`} onPress={capture} loading={busy} /> : null}
      {photoUri ? <Card>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        <Text style={styles.title}>Review before anything is saved</Text>
        <Text style={styles.body}>Recipe Reborn will extract a draft list. You can correct every item before confirming the inventory.</Text>
        <Button label={mode === 'label' ? 'Enter label ingredients' : 'Extract and review items'} onPress={() => mode === 'label'
          ? router.push('/generate')
          : router.push({ pathname: '/pantry-review', params: { uri: photoUri, location: mode } })} />
        <Button label="Retake" secondary onPress={() => setPhotoUri(null)} />
      </Card> : null}

      <InlineError message={error} />
      {product ? <Card>
        <Text style={styles.title}>{product.found ? (product.name || 'Product found') : 'Barcode not found'}</Text>
        <Text style={styles.body}>{product.found ? (product.ingredients_text || 'No ingredient list was supplied by Open Food Facts.') : 'Try the label-photo mode instead.'}</Text>
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

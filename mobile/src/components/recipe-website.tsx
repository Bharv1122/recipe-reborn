import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { READ_PAGE_RECIPE, sameRecipeWebsite } from '../../../shared/recipe-browser';
import { Button, InlineError } from './ui';
import { colors } from '@/theme';

export function RecipeWebsite({ url, onClose, onRead }: { url: string; onClose(): void; onRead(text: string): void }) {
  const browser = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const pending = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRead = () => { pending.current = false; setReading(false); if (timeout.current) clearTimeout(timeout.current); };
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Import from website</Text>
        <Text numberOfLines={1} style={styles.note}>{new URL(url).hostname}</Text>
        <Text style={styles.note}>Open the recipe, then tap Use page recipe. You can review its text before importing.</Text>
        <InlineError message={error} />
        <View style={styles.buttons}><View style={styles.button}><Button label="Close" secondary onPress={onClose} /></View><View style={styles.button}><Button label="Use page recipe" disabled={loading || reading} onPress={() => {
          pending.current = true; setReading(true); setError(null);
          timeout.current = setTimeout(() => { stopRead(); setError('The page did not respond. Wait for it to load, then try again.'); }, 8000);
          browser.current?.injectJavaScript(READ_PAGE_RECIPE);
        }} /></View></View>
      </View>
      <WebView ref={browser} source={{ uri: url }} style={styles.browser} incognito
        originWhitelist={['*']} mixedContentMode="never" allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows
        onOpenWindow={() => setError('Stay on this recipe page to import it.')}
        onShouldStartLoadWithRequest={request => sameRecipeWebsite(request.url, url)}
        onLoadStart={() => { stopRead(); setLoading(true); }} onLoadEnd={() => setLoading(false)}
        onError={() => { stopRead(); setLoading(false); setError('The website could not be opened. Try Text, Photo, or File.'); }}
        onMessage={event => {
          if (!pending.current || !sameRecipeWebsite(event.nativeEvent.url, url)) return;
          stopRead();
          try {
            if (event.nativeEvent.data.length > 150000) throw new Error('Too much page content');
            const value: unknown = JSON.parse(event.nativeEvent.data);
            if (!value || typeof value !== 'object') throw new Error('Invalid page content');
            const data = value as { text?: unknown; error?: unknown };
            if (typeof data.text === 'string' && data.text.trim() && data.text.length <= 100000) onRead(data.text);
            else setError(typeof data.error === 'string' ? data.error.slice(0, 300) : 'No recipe found. Try Text or a screenshot.');
          } catch { setError('The page did not return readable recipe text. Try Text or a screenshot.'); }
        }} />
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream }, toolbar: { padding: 12, gap: 8 },
  title: { color: colors.greenDark, fontSize: 20, fontWeight: '800' }, note: { color: colors.muted, fontSize: 12 },
  buttons: { flexDirection: 'row', gap: 8 }, button: { flex: 1 }, browser: { flex: 1 },
});

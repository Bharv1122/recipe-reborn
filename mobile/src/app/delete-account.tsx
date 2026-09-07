import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function DeleteAccountScreen() {
  const router = useRouter(); const { signOut } = useAuth(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const remove = async () => { setBusy(true); setError(null); try { await apiRequest('/api/mobile/account/delete', { method: 'POST', body: JSON.stringify({ password, confirmation }) }); await signOut(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not delete the account.'); } finally { setBusy(false); } };
  return <Screen><Stack.Screen options={{ headerShown: true, title: 'Delete account', headerTintColor: colors.danger }} /><ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.title}>Permanently delete your account</Text><Text style={styles.warning}>This removes your recipes, collections, meal plans, shopping lists, pantry inventory, and profile. It cannot be undone.</Text><Text style={styles.body}>If you have an active subscription purchased outside the app, cancel it through the same service before deleting your account so billing cannot continue afterward.</Text><Field accessibilityLabel="Password" autoComplete="current-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" /><Field accessibilityLabel="Deletion confirmation" accessibilityHint="Type the word DELETE" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" placeholder="Type DELETE" /><InlineError message={error} /><Button label="Permanently delete account" onPress={remove} loading={busy} disabled={!password || confirmation !== 'DELETE'} /><Button label="Keep my account" secondary onPress={() => router.back()} /></Card></ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: 14 }, title: { fontSize: 22, fontWeight: '800', color: colors.danger }, warning: { color: colors.danger, fontWeight: '700', lineHeight: 21 }, body: { color: colors.muted, lineHeight: 21 } });

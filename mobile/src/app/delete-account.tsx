import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';
import { deleteAccountChatHistory } from '@/services/chat-history';

export default function DeleteAccountScreen() {
  const router = useRouter(); const db = useSQLiteContext(); const { user, signOut } = useAuth(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (busy || !user) return;
    setBusy(true); setError(null);
    let accountDeleted = false;
    try {
      await apiRequest('/api/mobile/account/delete', { method: 'POST', body: JSON.stringify({ password, confirmation }) });
      accountDeleted = true;
      try { await deleteAccountChatHistory(db, user.id); }
      finally { await signOut(); }
    } catch (value) {
      if (accountDeleted) {
        Alert.alert('Account deleted', 'Your online account was deleted, but this phone could not finish clearing local data. Clear Recipe Reborn storage in Android settings, or remove the app from this device.');
      } else {
        setError(value instanceof Error ? value.message : 'Could not delete the account.');
      }
    } finally { setBusy(false); }
  };
  return <Screen><Stack.Screen options={{ headerShown: true, title: 'Delete account', headerTintColor: colors.danger }} /><ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.title}>Permanently delete your account</Text><Text style={styles.warning}>This removes your recipes, collections, meal plans, shopping lists, pantry inventory, and profile. It cannot be undone.</Text><Text style={styles.body}>If you have an active subscription purchased outside the app, cancel it through the same service before deleting your account so billing cannot continue afterward.</Text><Field accessibilityLabel="Password" autoComplete="current-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" /><Field accessibilityLabel="Deletion confirmation" accessibilityHint="Type the word DELETE" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" placeholder="Type DELETE" /><InlineError message={error} /><Button label="Permanently delete account" onPress={remove} loading={busy} disabled={!password || confirmation !== 'DELETE'} /><Button label="Keep my account" secondary onPress={() => router.back()} /></Card></ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: 14 }, title: { fontSize: 22, fontWeight: '800', color: colors.danger }, warning: { color: colors.danger, fontWeight: '700', lineHeight: 21 }, body: { color: colors.muted, lineHeight: 21 } });

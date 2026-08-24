import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { publicRequest } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const submit = async () => { setBusy(true); setError(null); try { const data = await publicRequest<{ message: string }>('/api/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }); setMessage(data.message); } catch (value) { setError(value instanceof Error ? value.message : 'Could not request a reset.'); } finally { setBusy(false); } };
  return <Screen><Stack.Screen options={{ headerShown: true, title: 'Reset password', headerTintColor: colors.green }} /><ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.title}>Reset your password</Text><Text style={styles.body}>We’ll email the same secure reset link used by RecipeReborn.com.</Text><Field value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" /><Button label="Email reset link" onPress={submit} loading={busy} disabled={!email.includes('@')} />{message ? <Text style={styles.success}>{message}</Text> : null}<InlineError message={error} /><Button label="Back to sign in" secondary onPress={() => router.replace('/(auth)/sign-in')} /></Card></ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: 14 }, title: { fontSize: 22, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 }, success: { color: colors.green, fontWeight: '700' } });

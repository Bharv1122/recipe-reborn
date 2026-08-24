import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { publicRequest } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter(); const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const submit = async () => { if (!token) return setError('This reset link is missing its secure token.'); if (password !== confirm) return setError('Passwords do not match.'); setBusy(true); setError(null); try { const data = await publicRequest<{ message: string }>('/api/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }); setMessage(data.message); } catch (value) { setError(value instanceof Error ? value.message : 'Could not reset the password.'); } finally { setBusy(false); } };
  return <Screen><Stack.Screen options={{ headerShown: true, title: 'Choose new password', headerTintColor: colors.green }} /><ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.title}>Choose a new password</Text><Field value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" /><Field value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm password" /><Button label="Update password" onPress={submit} loading={busy} disabled={password.length < 8 || !confirm} />{message ? <><Text style={styles.success}>{message}</Text><Button label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} /></> : null}<InlineError message={error} /></Card></ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: 14 }, title: { fontSize: 22, fontWeight: '800', color: colors.ink }, success: { color: colors.green, fontWeight: '700' } });

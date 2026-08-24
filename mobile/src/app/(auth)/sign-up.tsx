import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await signUp(email, password, code); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to create account.'); }
    finally { setBusy(false); }
  };

  return <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Your Premium, allergy, and community-code rules are enforced by the same Recipe Reborn server as the website.</Text>
        <Card>
          <Field accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
          <Field accessibilityLabel="Password" autoCapitalize="none" secureTextEntry placeholder="Password (6+ characters)" value={password} onChangeText={setPassword} />
          <Field accessibilityLabel="Community code" autoCapitalize="characters" placeholder="Community code (optional)" value={code} onChangeText={setCode} />
          <InlineError message={error} />
          <Button label="Create account" onPress={submit} loading={busy} disabled={!email || password.length < 6} />
          <Link href="/(auth)/sign-in" style={styles.link}>Back to sign in</Link>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  subtitle: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  link: { color: colors.green, fontWeight: '700', textAlign: 'center', padding: 8 },
});

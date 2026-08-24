import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('@/assets/images/recipe-reborn-logo.png')} style={styles.logo} />
          <Text style={styles.title}>Recipe Reborn</Text>
          <Text style={styles.subtitle}>Fresh-food recipes from the ingredients already around you.</Text>
          <Card>
            <Field accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
            <Field accessibilityLabel="Password" autoCapitalize="none" autoComplete="current-password" secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} />
            <InlineError message={error} />
            <Button label="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
            <Link href="/(auth)/sign-up" style={styles.link}>Create an account</Link>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', gap: 12 },
  logo: { width: 84, height: 84, alignSelf: 'center', resizeMode: 'contain' },
  title: { fontSize: 32, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 16, textAlign: 'center', marginBottom: 12 },
  link: { color: colors.green, fontWeight: '700', textAlign: 'center', padding: 8 },
});

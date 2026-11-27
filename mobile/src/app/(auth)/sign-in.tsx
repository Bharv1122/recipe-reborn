import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { GoogleLoginButton } from '@/components/google-login-button';
import { colors } from '@/theme';
import { ApiError } from '@/services/api';

export default function SignInScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };
  const googleSubmit = async () => {
    if (busy || (linkingGoogle && !password)) return;
    const submittedPassword = password;
    setBusy(true); setError(null); setGoogleNotice(null);
    try { if (!await signInWithGoogle(adultConfirmed, submittedPassword)) setGoogleNotice('Google sign-in canceled. You can still use email and password.'); }
    catch (value) {
      if (value instanceof ApiError && ['LINK_PASSWORD_REQUIRED', 'LINK_PASSWORD_INVALID', 'LINK_PASSWORD_SETUP_REQUIRED'].includes(value.code || '')) {
        setLinkingGoogle(true);
        setError(value.code === 'LINK_PASSWORD_REQUIRED' && submittedPassword
          ? 'The password could not be verified for the selected Google account. Use its RecipeReborn password, not your Google password. If unsure, use Forgot password instead of retrying.'
          : value.message);
      } else setError(value instanceof Error ? value.message : 'Unable to sign in with Google.');
    }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image accessible={false} source={require('@/assets/images/recipe-reborn-logo.png')} style={styles.logo} />
          <Text style={styles.title}>Recipe Reborn</Text>
          <Text style={styles.subtitle}>Fresh-food recipes from the ingredients already around you.</Text>
          <Card>
            <Text style={styles.subtitle}>Sign in to keep your saved recipes, meal plans and food preferences together across your devices.</Text>
            <Field accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
            {linkingGoogle && <Text accessibilityRole="header" style={styles.linkTitle}>Connect your existing account</Text>}
            {linkingGoogle && <Text style={styles.subtitle}>Enter the RecipeReborn password for the Google account you selected. Your email field can stay blank. Then choose Connect Google below and select the same Google account.</Text>}
            <Field accessibilityLabel="Password" autoCapitalize="none" autoComplete="current-password" secureTextEntry placeholder={linkingGoogle ? 'RecipeReborn password' : 'Password'} value={password} onChangeText={value => { setPassword(value); setError(null); }} />
            <InlineError message={error} />
            <Button label="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
            {Platform.OS === 'android' && <>
              {linkingGoogle ? <Button label="Connect Google to my existing account" onPress={googleSubmit} loading={busy} disabled={!password} /> : <GoogleLoginButton onPress={googleSubmit} disabled={busy} />}
              <View style={styles.ageRow}><Switch accessibilityLabel="I am 18 or older, for a new Google account" value={adultConfirmed} onValueChange={setAdultConfirmed} disabled={busy} /><Text style={styles.ageText}>I am 18 or older (required to create a new account).</Text></View>
              <Text style={styles.subtitle}>Already have an account? Your RecipeReborn password above is required the first time you connect Google. Google never receives that password.</Text>
              {googleNotice && <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{googleNotice}</Text>}
            </>}
            <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
            <Link href="/walkthrough" style={styles.link}>Try guided practice without signing in</Link>
            <Link href="/(auth)/sign-up" style={styles.link}>Create an account</Link>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkTitle: { color: colors.greenDark, fontWeight: '800', fontSize: 19 },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, ageText: { flex: 1, color: colors.muted },
  flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', gap: 12 },
  logo: { width: 84, height: 84, alignSelf: 'center', resizeMode: 'contain' },
  title: { fontSize: 32, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 16, textAlign: 'center', marginBottom: 12 },
  link: { color: colors.green, fontWeight: '700', textAlign: 'center', padding: 10, minHeight: 44 },
});

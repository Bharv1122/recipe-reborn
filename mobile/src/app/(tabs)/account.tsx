import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest } from '@/services/api';
import { registerPushNotifications, scheduleMealReminder } from '@/services/notifications';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Subscription { tier: string; status: string; generationCount: number; currentPeriodEnd: string | null; canManageOnWeb: boolean; hasStripeSubscription: boolean }

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<{ subscription: Subscription }>('/api/mobile/account/subscription')
      .then((data) => setSubscription(data.subscription))
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load account.'));
  }, []);

  const portal = async () => {
    setBusy(true); setError(null);
    try {
      const { url } = await apiRequest<{ url: string }>('/api/mobile/account/portal', { method: 'POST' });
      await WebBrowser.openBrowserAsync(url);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not open subscription management.'); }
    finally { setBusy(false); }
  };
  const testReminder = async () => {
    setError(null); setMessage(null);
    try { await scheduleMealReminder('Your test meal reminder is ready.', new Date(Date.now() + 60_000)); setMessage('A local test reminder is scheduled for one minute from now.'); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not enable reminders.'); }
  };
  const enablePush = async () => {
    setBusy(true); setError(null);
    try { await registerPushNotifications(); setMessage('This phone is registered for Recipe Reborn notifications.'); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not register this phone.'); }
    finally { setBusy(false); }
  };

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <Card>
      <Text style={styles.title}>{user?.name || 'Recipe Reborn account'}</Text><Text style={styles.body}>{user?.email}</Text>
      <Text style={styles.plan}>{subscription ? `${subscription.tier.toUpperCase()} · ${subscription.status}` : 'Loading plan…'}</Text>
      {subscription?.currentPeriodEnd ? <Text style={styles.body}>Current period ends {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</Text> : null}
      {subscription?.canManageOnWeb ? <Button label="Manage existing subscription" onPress={portal} loading={busy} /> : <Text style={styles.body}>Premium purchase is not exposed in the native beta until Apple and Google billing requirements are finalized.</Text>}
    </Card>
    <Card><Text style={styles.title}>Your Recipe Reborn</Text><Button label="Saved recipes" secondary onPress={() => router.push('/recipes')} /><Button label="Collections" secondary onPress={() => router.push('/collections')} /><Button label="Meal plans" secondary onPress={() => router.push('/meal-plans')} /><Button label="Reviewed pantry inventory" secondary onPress={() => router.push('/pantry-review')} /></Card>
    <Card><Text style={styles.title}>Allergy and safety rules</Text><Text style={styles.body}>Allergies: {user?.allergies?.length ? user.allergies.join(', ') : 'None saved'}</Text><Text style={styles.body}>Generation remains server-controlled. The native app cannot weaken allergy, safety, Premium, trial, or community-code rules.</Text></Card>
    <Card><Text style={styles.title}>Notifications</Text><Text style={styles.body}>Local reminders stay on this phone. Push registration is opt-in and becomes available after the signed beta is linked to its Expo project.</Text><Button label="Schedule 1-minute local test" secondary onPress={testReminder} /><Button label="Enable push beta" secondary onPress={enablePush} loading={busy} />{message ? <Text style={styles.success}>{message}</Text> : null}</Card>
    <Card><Text style={styles.title}>Privacy and account</Text><Button label="Privacy policy" secondary onPress={() => Linking.openURL('https://recipereborn.com/privacy')} /><Button label="Terms" secondary onPress={() => Linking.openURL('https://recipereborn.com/terms')} /><Button label="Reset password" secondary onPress={() => router.push('/forgot-password')} /><Button label="Delete account" secondary onPress={() => router.push('/delete-account')} /></Card>
    <InlineError message={error} /><Button label="Sign out" secondary onPress={signOut} />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 30 }, title: { fontSize: 19, fontWeight: '800', color: colors.ink }, body: { color: colors.muted, lineHeight: 21 }, plan: { color: colors.green, fontWeight: '800' }, success: { color: colors.green, fontWeight: '700' } });

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { apiRequest } from '@/services/api';
import { scheduleMealReminder } from '@/services/notifications';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Entitlement { tier: string; status: string; currentPeriodEnd: string | null; trial: null | { label: string; days: number; fullPremium: boolean } }

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ entitlement: Entitlement }>('/api/mobile/auth/me')
      .then((data) => setEntitlement(data.entitlement))
      .catch((value) => setError(value instanceof Error ? value.message : 'Could not load account.'));
  }, []);

  const testReminder = async () => {
    setError(null); setMessage(null);
    try {
      await scheduleMealReminder('Your test meal reminder is ready.', new Date(Date.now() + 60_000));
      setMessage('A local test reminder is scheduled for one minute from now.');
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not enable reminders.'); }
  };

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <Card>
      <Text style={styles.title}>{user?.name || 'Recipe Reborn account'}</Text>
      <Text style={styles.body}>{user?.email}</Text>
      <Text style={styles.plan}>{entitlement ? `${entitlement.tier.toUpperCase()} · ${entitlement.status}` : 'Loading plan…'}</Text>
      {entitlement?.trial ? <Text style={styles.body}>{entitlement.trial.label}: {entitlement.trial.days} days{entitlement.trial.fullPremium ? ', full Premium' : ''}</Text> : null}
    </Card>
    <Card>
      <Text style={styles.title}>Allergy and safety rules</Text>
      <Text style={styles.body}>Allergies: {user?.allergies?.length ? user.allergies.join(', ') : 'None saved'}</Text>
      <Text style={styles.body}>The app only displays these settings. Generation endpoints on the server remain the final authority.</Text>
    </Card>
    <Card>
      <Text style={styles.title}>Meal reminders</Text>
      <Text style={styles.body}>Permission is requested only after you choose to enable a reminder. This foundation uses on-device reminders and does not upload a push token.</Text>
      <Button label="Schedule 1-minute test" secondary onPress={testReminder} />
      {message ? <Text style={styles.success}>{message}</Text> : null}
    </Card>
    <InlineError message={error} />
    <Button label="Sign out" secondary onPress={signOut} />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, title: { fontSize: 19, fontWeight: '800', color: colors.ink },
  body: { color: colors.muted, lineHeight: 21 }, plan: { color: colors.green, fontWeight: '800' }, success: { color: colors.green, fontWeight: '700' },
});

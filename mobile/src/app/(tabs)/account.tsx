import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { registerPushNotifications, scheduleMealReminder } from '@/services/notifications';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Subscription { tier: string; status: string; generationCount: number; currentPeriodEnd: string | null }

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut, refreshAccount } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [allergies, setAllergies] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [likes, setLikes] = useState('');
  const preferencesDirty = useRef(false);

  useEffect(() => {
    if (!user || preferencesDirty.current) return;
    setAllergies((user.allergies ?? []).join(', '));
    setDislikes((user.dislikedIngredients ?? []).join(', '));
    setLikes((user.likedIngredients ?? []).join(', '));
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    let active = true;
    setSubscription(null); setError(null);
    apiRequest<{ subscription: Subscription }>('/api/mobile/account/subscription')
      .then((data) => { if (active) setSubscription(data.subscription); })
      .catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Could not load account.'); });
    refreshAccount().catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Could not refresh food preferences.'); });
    return () => { active = false; };
  }, [user?.id, refreshAccount]));

  const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
  const savePreferences = async () => {
    if (savingPreferences) return;
    setSavingPreferences(true); setError(null); setMessage(null);
    try {
      await apiRequest('/api/user/preferences', { method: 'PUT', body: JSON.stringify({ allergies: splitList(allergies), dislikedIngredients: splitList(dislikes), likedIngredients: splitList(likes) }) });
      preferencesDirty.current = false;
      await refreshAccount();
      setMessage('Food preferences saved. New recipes and meal plans will use them.');
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save food preferences.'); }
    finally { setSavingPreferences(false); }
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
      <Text style={styles.body}>Your membership is linked to this account.</Text>
      <Text style={styles.body}>Purchases are not available in this app. Sign in with your existing membership account.</Text>
    </Card>
    <Card><Text style={styles.title}>Your Recipe Reborn</Text><Button label="Saved recipes" secondary onPress={() => router.push('/recipes')} /><Button label="Collections" secondary onPress={() => router.push('/collections')} /><Button label="Meal plans" secondary onPress={() => router.push('/meal-plans')} /><Button label="Reviewed pantry inventory" secondary onPress={() => router.push('/pantry-review')} /></Card>
    <Card>
      <Text style={styles.title}>Your food preferences</Text>
      <Text style={styles.body}>Saved to your account and used on web and Android.</Text>
      <Text style={styles.label}>Allergies to avoid</Text><Field accessibilityLabel="Allergies" value={allergies} onChangeText={(value) => { preferencesDirty.current = true; setAllergies(value); }} placeholder="Shellfish, peanuts" multiline />
      <Text style={styles.label}>Disliked ingredients — excluded</Text><Field accessibilityLabel="Disliked ingredients" value={dislikes} onChangeText={(value) => { preferencesDirty.current = true; setDislikes(value); }} placeholder="Cilantro, bell peppers" multiline />
      <Text style={styles.label}>Ingredients you like — favored when they fit</Text><Field accessibilityLabel="Liked ingredients" value={likes} onChangeText={(value) => { preferencesDirty.current = true; setLikes(value); }} placeholder="Spinach, lemon" multiline />
      <Text style={styles.body}>Separate items with commas. Likes never override allergies or dislikes.</Text>
      <Text style={styles.body}>Always review generated recipes and product labels. These checks are not medical advice or a guarantee.</Text>
      <Button label="Save food preferences" onPress={savePreferences} loading={savingPreferences} />
    </Card>
    <Card><Text style={styles.title}>Notifications</Text><Text style={styles.body}>Local reminders stay on this phone. Push registration is opt-in and becomes available after the signed beta is linked to its Expo project.</Text><Button label="Schedule 1-minute local test" secondary onPress={testReminder} /><Button label="Enable push beta" secondary onPress={enablePush} loading={busy} /></Card>
    <Card><Text style={styles.title}>Privacy and account</Text><Button label="Privacy policy" secondary onPress={() => Linking.openURL('https://recipereborn.com/privacy')} /><Button label="Terms" secondary onPress={() => Linking.openURL('https://recipereborn.com/terms')} /><Button label="Reset password" secondary onPress={() => router.push('/forgot-password')} /><Button label="Delete account" secondary onPress={() => router.push('/delete-account')} /></Card>
    <InlineError message={error} />{message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}<Button label="Sign out" secondary onPress={signOut} />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 30 }, title: { fontSize: 19, fontWeight: '800', color: colors.ink }, label: { color: colors.ink, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 21 }, plan: { color: colors.green, fontWeight: '800' }, success: { color: colors.green, fontWeight: '700' } });

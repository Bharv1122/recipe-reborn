import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image source={require('@/assets/images/recipe-reborn-logo.png')} style={styles.logo} />
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>{user?.name || 'What will we make?'}</Text>
        </View>
      </View>
      <Card>
        <Text style={styles.cardTitle}>Generate and save recipes</Text>
        <Text style={styles.body}>{"Create from a label or your reviewed pantry. Your account's Premium, allergy, and safety rules are applied by the server."}</Text>
        <Button label="Generate recipe" onPress={() => router.push('/generate')} />
        <Button label="Browse saved recipes" secondary onPress={() => router.push('/recipes')} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Scan a packaged food</Text>
        <Text style={styles.body}>Read a barcode, photograph a label, or build a reviewed fridge-and-pantry inventory.</Text>
        <Button label="Open camera" onPress={() => router.push('/(tabs)/scan')} />
        <Button label="Review pantry inventory" secondary onPress={() => router.push('/pantry-review')} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Plan the week</Text>
        <Button label="Collections" secondary onPress={() => router.push('/collections')} />
        <Button label="Meal plans" secondary onPress={() => router.push('/meal-plans')} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Shopping list, even offline</Text>
        <Text style={styles.body}>Lists are cached on the device. Check-offs queue safely and sync when the connection returns.</Text>
        <Button label="View shopping lists" secondary onPress={() => router.push('/(tabs)/shopping')} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Backend rules remain authoritative</Text>
        <Text style={styles.body}>Premium access, trial length, generation limits, allergies, and disliked ingredients are never decided by the app.</Text>
      </Card>
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 30 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  logo: { width: 68, height: 68, resizeMode: 'contain' }, heroText: { flex: 1 },
  eyebrow: { color: colors.orange, fontWeight: '800', fontSize: 12 }, title: { color: colors.greenDark, fontWeight: '800', fontSize: 25 },
  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 18 }, body: { color: colors.muted, lineHeight: 21 },
});

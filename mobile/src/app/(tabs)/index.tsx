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
        <Text style={styles.cardTitle}>Scan a packaged food</Text>
        <Text style={styles.body}>Read a barcode now. Label and pantry-photo capture are ready for the reviewed-inventory workflow.</Text>
        <Button label="Open camera" onPress={() => router.push('/(tabs)/scan')} />
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

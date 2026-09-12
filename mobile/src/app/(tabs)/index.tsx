import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image accessible={false} source={require('@/assets/images/recipe-reborn-logo.png')} style={styles.logo} />
        <View style={styles.heroText}>
          <Text style={styles.title}>What are we making?</Text>
          <Text style={styles.body}>Start with a package, a few ingredients, or a dish you love.</Text>
        </View>
      </View>
      <Card>
        <Text style={styles.cardTitle}>Make it homemade</Text>
        <Text style={styles.body}>Scan a packaged food to make your own version.</Text>
        <Button label="Scan a package" onPress={() => router.push('/(tabs)/scan')} />
      </Card>
      <Pressable accessibilityRole="button" accessibilityLabel="Use my ingredients" onPress={() => router.push({ pathname: '/generate', params: { source: 'pantry' } })} style={styles.choice}>
        <View style={styles.choiceText}><Text style={styles.cardTitle}>Use my ingredients</Text><Text style={styles.body}>Speak, type, or photograph your fridge and pantry.</Text></View><Text accessible={false} style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose a dish" onPress={() => router.push({ pathname: '/generate', params: { source: 'dish' } })} style={styles.choice}>
        <View style={styles.choiceText}><Text style={styles.cardTitle}>Choose a dish</Text><Text style={styles.body}>Tell us what you want to cook.</Text></View><Text accessible={false} style={styles.arrow}>›</Text>
      </Pressable>
      <Button label="Need cooking help? Ask AI Chef" secondary onPress={() => router.push('/chat')} />
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 48, height: 48, resizeMode: 'contain' }, heroText: { flex: 1, gap: 6 },
  title: { color: colors.greenDark, fontWeight: '800', fontSize: 24 },
  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 18 }, body: { color: colors.muted, lineHeight: 21 },
  choice: { minHeight: 88, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line },
  choiceText: { flex: 1, gap: 5 }, arrow: { fontSize: 28, color: colors.green },
});

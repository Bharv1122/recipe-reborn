import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const choices = [
    { title: 'Scan a package', icon: '▥', description: 'Scan a food label or barcode and make it homemade.', go: () => router.push('/(tabs)/scan') },
    { title: 'Plan my meals', icon: '▦', description: 'Preview a week of meals and save only what you want.', go: () => router.push('/(tabs)/plans') },
    { title: 'Use my ingredients', icon: '♧', description: 'Speak, type, or photograph what you have.', go: () => router.push({ pathname: '/generate', params: { source: 'pantry' } }) },
    { title: 'Choose a dish', icon: '♨', description: 'Tell us what you would like to cook.', go: () => router.push({ pathname: '/generate', params: { source: 'dish' } }) },
    { title: 'Import a recipe', icon: '▤', description: 'Bring a recipe from a photo, file, or website.', go: () => router.push('/import-recipe') },
    { title: 'Ask AI Chef', icon: '✧', description: 'Get recipe ideas and help with your cooking.', go: () => router.push('/chat') },
  ];
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}><Image accessible={false} source={require('@/assets/images/recipe-reborn-logo.png')} style={styles.logo} /><View style={styles.grow}><Text style={styles.title}>What are we making?</Text><Text style={styles.body}>Pick a way to start something delicious.</Text></View></View>
    {choices.map(choice => <Card key={choice.title}><View style={styles.row}><Text accessible={false} style={styles.icon}>{choice.icon}</Text><View style={styles.grow}><Text style={styles.cardTitle}>{choice.title}</Text><Text style={styles.body}>{choice.description}</Text></View></View><Button label={choice.title} onPress={choice.go} /></Card>)}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 48, height: 48, resizeMode: 'contain' }, grow: { flex: 1, gap: 6 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 }, icon: { fontSize: 30, width: 38, textAlign: 'center', color: colors.green },
  title: { color: colors.greenDark, fontWeight: '800', fontSize: 24 }, cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 18 }, body: { color: colors.muted, lineHeight: 21 },
});

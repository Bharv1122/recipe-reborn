import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cookingIdeaForDate, cookingTips } from '@/content/cooking-ideas';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [tipIndex, setTipIndex] = useState(0);
  const idea = cookingIdeaForDate(new Date());
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
    <Card><Text style={styles.cardTitle}>Try a packaged favorite</Text><Text style={styles.body}>Practice reviewing, customizing and comparing a homemade recipe. Nothing is saved.</Text><Button label="Start guided practice" secondary onPress={() => router.push('/walkthrough')} /></Card>
    {choices.map(choice => <Card key={choice.title}><View style={styles.row}><Text accessible={false} style={styles.icon}>{choice.icon}</Text><View style={styles.grow}><Text style={styles.cardTitle}>{choice.title}</Text><Text style={styles.body}>{choice.description}</Text></View></View><Button label={choice.title} onPress={choice.go} /></Card>)}
    <Card><Text accessibilityRole="header" style={styles.cardTitle}>This week’s cooking idea</Text><Text style={styles.body}>{idea.title}: {idea.prompt}.</Text><Text style={styles.body}>Ideas rotate weekly. Review the prompt and your food preferences before generating a recipe online.</Text><Button label="Explore this recipe idea" secondary onPress={() => router.push({ pathname: '/generate', params: { source: 'dish', idea: idea.prompt } })} /></Card>
    <Card><Text accessibilityRole="header" style={styles.cardTitle}>A little cooking know-how</Text><Text accessibilityLiveRegion="polite" style={styles.body}>{cookingTips[tipIndex]}</Text><Button label="Next cooking tip" secondary onPress={() => setTipIndex(index => (index + 1) % cookingTips.length)} /></Card>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 48, height: 48, resizeMode: 'contain' }, grow: { flex: 1, gap: 6 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 }, icon: { fontSize: 30, width: 38, textAlign: 'center', color: colors.green },
  title: { color: colors.greenDark, fontWeight: '800', fontSize: 24 }, cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 18 }, body: { color: colors.muted, lineHeight: 21 },
});

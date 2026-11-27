import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/theme';

const lessons = [
  ['Start with a packaged favorite', 'Practice with an example chili package. In Scan a package, scan a barcode or photograph a food label. Check the product and ingredients before continuing.'],
  ['Review the ingredients', 'Check the ingredients and allergens on the actual package. A lookup or photo can miss details.'],
  ['Make it yours', 'Choose a change for this practice recipe. Review substitutions and cooking instructions before saving a real recipe.'],
  ['Package facts and homemade estimates', 'Homemade nutrition is estimated. Compare the same serving size and check the package label.'],
  ['Ready to make it homemade', 'Nothing was added to your saved recipes, meal plans or shopping lists.'],
] as const;

// Local practice only: never generates, saves or edits user data.
export default function WalkthroughScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [protein, setProtein] = useState<'beef' | 'lentils'>('beef');
  const [audio, setAudio] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [title, explanation] = lessons[step];
  useEffect(() => {
    let cancelled = false;
    void Speech.stop().then(() => {
      if (audio && !cancelled) Speech.speak(`${title}. ${explanation}`, { language: 'en-US', onError: () => setAudioError(true) });
    }).catch(() => setAudioError(true));
    return () => { cancelled = true; void Speech.stop().catch(() => {}); };
  }, [audio, title, explanation]);
  useFocusEffect(useCallback(() => () => { void Speech.stop().catch(() => {}); }, []));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { setAudio(false); void Speech.stop().catch(() => {}); }
    });
    return () => listener.remove();
  }, []);
  const finish = () => { void Speech.stop().catch(() => {}); router.replace('/(tabs)'); };
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.row}><Text style={styles.label}>Practice · {step + 1} of {lessons.length}</Text><Button label="Skip" secondary onPress={finish} /></View>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
    <Text style={styles.body}>{explanation}</Text>
    <View style={styles.row}><Text style={styles.body}>Read steps aloud</Text><Switch accessibilityLabel="Read steps aloud" value={audio} onValueChange={value => { setAudioError(false); setAudio(value); }} /></View>
    {audioError && <Text accessibilityLiveRegion="polite" style={styles.body}>Audio is unavailable. All instructions are shown on screen.</Text>}
    {step === 0 && <Card><Text style={styles.heading}>Example package: chili</Text><Text style={styles.body}>Guided example only: this does not open the camera or look up a real product.</Text><Button label="Try the example package" onPress={() => setStep(1)} /></Card>}
    {step === 1 && <Card><Text style={styles.heading}>Example ingredients</Text><Text style={styles.body}>Beef, tomatoes, beans, salt, spices.</Text><Button label={reviewed ? 'Ingredients checked' : 'I checked the example ingredients'} secondary onPress={() => setReviewed(true)} /><Button label="Make a homemade version" disabled={!reviewed} onPress={() => setStep(2)} /></Card>}
    {step === 2 && <Card><Text style={styles.heading}>Homemade chili · practice recipe</Text><Button label={protein === 'beef' ? 'Beef selected' : 'Choose beef'} secondary={protein !== 'beef'} onPress={() => setProtein('beef')} /><Button label={protein === 'lentils' ? 'Lentils selected' : 'Try lentils instead'} secondary={protein !== 'lentils'} onPress={() => setProtein('lentils')} /><Text accessibilityLiveRegion="polite" style={styles.body}>{protein === 'lentils' ? 'Your practice chili now uses lentils, tomatoes, beans and spices. Real substitutions also need adjusted quantities and cooking times.' : 'Your practice chili uses beef, tomatoes, beans and spices. Cook ground beef thoroughly using a food thermometer.'}</Text><Button label="Explore estimated nutrition" onPress={() => setStep(3)} /></Card>}
    {step === 3 && <Card><Text style={styles.heading}>Package label ↔ homemade estimate</Text><Text style={styles.body}>A larger homemade portion can have higher totals. First check serving sizes on both sides.</Text><Button label={comparisonOpen ? 'Hide comparison checklist' : 'Check how to compare'} secondary onPress={() => setComparisonOpen(value => !value)} />{comparisonOpen && <Text accessibilityLiveRegion="polite" style={styles.body}>1. Match serving weights or portions.{'\n'}2. Compare calories, protein, fat, carbohydrates and sodium.{'\n'}3. Homemade values are estimates; ingredient brands and amounts change them.{'\n'}No nutrition numbers are invented for this example.</Text>}<Button label="Finish practice" disabled={!comparisonOpen} onPress={() => setStep(4)} /></Card>}
    {step === 4 && <Card><Text style={styles.heading}>Practice complete</Text><Text style={styles.body}>Choose Scan a package on Home to try your own favorite. Review the result, customize it and save only what you want. Plan meals from Home and keep groceries in the Shopping tab. Replay this practice from Account.</Text><Button label="Done" onPress={finish} /></Card>}
    {step > 0 && step < 4 && <Button label="Back" secondary onPress={() => setStep(value => value - 1)} />}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 28 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.muted, flex: 1 }, title: { color: colors.greenDark, fontSize: 27, fontWeight: '800' },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '700' }, body: { color: colors.ink, fontSize: 17, lineHeight: 25 },
});

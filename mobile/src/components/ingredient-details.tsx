import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '@/services/api';
import { colors } from '@/theme';
import { Button, InlineError } from './ui';

type Substitute = { name: string; ratio: string; notes: string };
type Info = {
  name: string; category: string;
  nutrition: Record<string, unknown>;
  healthBenefits: string[];
  substitutions: (string | { ingredient: string; ratio: string; note: string })[];
  allergens: string[]; seasonality: string; storageType: string; shelfLife: string;
};
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : 'Unavailable';
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

// Mounted only for the selected dialog. Closing or changing ingredients cancels its request.
export function IngredientDetails({ ingredient, mode, onSelect }: {
  ingredient: string; mode: 'info' | 'substitute'; onSelect(name: string): void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [options, setOptions] = useState<Substitute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => {
      if (active) { active = false; setError('This is taking too long. Please try again.'); controller.abort(); }
    }, 50_000);
    apiRequest<unknown>(mode === 'info' ? '/api/ingredient-info' : '/api/ingredient-substitute', {
      method: 'POST', signal: controller.signal, body: JSON.stringify({ ingredient }),
    }).then(value => {
      if (!active) return;
      if (!value || typeof value !== 'object') throw new Error('Invalid ingredient response');
      if (mode === 'substitute') {
        const items = (value as { substitutes?: unknown }).substitutes;
        if (!Array.isArray(items) || !items.every(item => item && ['name', 'ratio', 'notes'].every(key => typeof item[key] === 'string'))) throw new Error('Invalid suggestions');
        setOptions(items.slice(0, 5));
      } else {
        const data = value as Info;
        if (typeof data.name !== 'string' || !data.nutrition || typeof data.nutrition !== 'object' || !strings(data.healthBenefits) || !strings(data.allergens) || !Array.isArray(data.substitutions) || !data.substitutions.every(item => typeof item === 'string' || (item && typeof item.ingredient === 'string'))) throw new Error('Invalid ingredient information');
        setInfo(data);
      }
    }).catch(() => {
      if (active) setError(mode === 'info' ? 'Ingredient information could not be loaded.' : 'Suggestions could not be loaded. You can still enter your own replacement below.');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [ingredient, mode, attempt]);
  return <View style={styles.section}>
    {!info && !options && !error ? <Text accessibilityLiveRegion="polite" style={styles.body}>{mode === 'info' ? 'Loading ingredient information…' : 'Finding substitutes…'}</Text> : null}
    <InlineError message={error} />
    {error ? <Button label="Try again" secondary onPress={() => { setInfo(null); setOptions(null); setError(null); setAttempt(value => value + 1); }} /> : null}
    {options ? <>
      <Text style={styles.heading}>Suggested substitutes</Text>
      {!options.length ? <Text style={styles.body}>No suitable suggestions were found for your saved preferences.</Text> : null}
      {options.map((item, index) => <View key={`${index}-${item.name}`} style={styles.option}>
        <Text style={styles.heading}>{item.name}</Text>
        <Text style={styles.body}>Ratio: {item.ratio}</Text>
        <Text style={styles.body}>{item.notes}</Text>
        <Button label={`Use ${item.name}`} secondary onPress={() => onSelect(item.name)} />
      </View>)}
      <Text style={styles.heading}>Or enter your own replacement</Text>
    </> : null}
    {info ? <>
      <Text style={styles.heading}>{info.name}</Text>
      <Text style={styles.body}>Category: {text(info.category)}</Text>
      <Text style={styles.heading}>Nutrition per 100 g</Text>
      <Text style={styles.note}>General estimates for this ingredient, not your recipe portion.</Text>
      {['calories', 'protein', 'carbs', 'fat', 'fiber'].map(key => <Text key={key} style={styles.body}>{key[0].toUpperCase() + key.slice(1)}: {text(info.nutrition[key])}</Text>)}
      {strings(info.nutrition.vitamins) && info.nutrition.vitamins.length ? <Text style={styles.body}>Vitamins: {info.nutrition.vitamins.join(', ')}</Text> : null}
      <Text style={styles.heading}>Benefits</Text>
      {info.healthBenefits.map((value, index) => <Text key={index} style={styles.body}>• {value}</Text>)}
      <Text style={styles.heading}>Possible substitutes</Text>
      {info.substitutions.map((value, index) => <Text key={index} style={styles.body}>{typeof value === 'string' ? value : `${value.ingredient} — ${text(value.ratio)}. ${text(value.note)}`}</Text>)}
      <Text style={styles.heading}>Allergens</Text>
      <Text style={styles.body}>{info.allergens.join(', ') || 'None listed; check the product label.'}</Text>
      <Text style={styles.heading}>Seasonality</Text><Text style={styles.body}>{text(info.seasonality)}</Text>
      <Text style={styles.heading}>Storage</Text><Text style={styles.body}>{text(info.storageType)}</Text>
      <Text style={styles.heading}>Shelf life</Text><Text style={styles.body}>{text(info.shelfLife)}</Text>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12 }, option: { gap: 8, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.greenDark },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink }, note: { fontSize: 12, lineHeight: 18, color: colors.muted },
});

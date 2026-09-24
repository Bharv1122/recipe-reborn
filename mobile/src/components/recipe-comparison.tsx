import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { colors } from '@/theme';
import type { GeneratedRecipe } from '@/types';
import { detectAdditives } from '../../../shared/additives';
import { NUTRIENT_FIELDS, hasNutritionValues, nullableNutritionNumber, type FreshNutritionEstimate, type OriginalNutrition } from '../../../shared/nutrition-facts';

export function PackageNutritionReview({ value, onChange }: { value: OriginalNutrition; onChange(value: OriginalNutrition): void }) {
  const [open, setOpen] = useState(false);
  const [draftValues, setDraftValues] = useState(() => Object.fromEntries(NUTRIENT_FIELDS.map(({ key }) => [key, value.values[key] === null ? '' : String(value.values[key])])));
  return <>
    <Button label={open ? 'Hide package nutrition' : value.reviewRequired ? 'Check scanned nutrition (optional)' : 'View package nutrition (optional)'} secondary onPress={() => setOpen(!open)} />
    {open ? <View style={styles.review}>
      <Text style={styles.note}>Check these values against the package. Leave missing values blank.</Text>
      <Text style={styles.label}>Serving size</Text>
      <Field accessibilityLabel="Package nutrition serving size" value={value.basisLabel} onChangeText={(basisLabel) => onChange({ ...value, basisLabel, reviewRequired: true })} />
      {NUTRIENT_FIELDS.map(({ key, label, unit }) => <View key={key} style={styles.review}>
        <Text style={styles.label}>{label} ({unit})</Text>
        <Field accessibilityLabel={`Package ${label} (${unit})`} keyboardType="decimal-pad" value={draftValues[key]} onChangeText={(input) => { setDraftValues((current) => ({ ...current, [key]: input })); onChange({ ...value, values: { ...value.values, [key]: nullableNutritionNumber(input) }, reviewRequired: true }); }} />
      </View>)}
      <Button label="These match my package" disabled={!value.basisLabel.trim() || !hasNutritionValues(value.values)} onPress={() => { onChange({ ...value, reviewRequired: false }); setOpen(false); }} />
    </View> : null}
  </>;
}

export type NutritionEstimateStatus = 'pending' | 'ready' | 'failed';

export function RecipeComparison({ recipe, originalIngredients, original, isPackage, savedNutrition = null, estimateOnMount = true, onNutrition, onStatusChange }: {
  recipe: GeneratedRecipe;
  originalIngredients: string;
  original: OriginalNutrition | null;
  isPackage: boolean;
  savedNutrition?: FreshNutritionEstimate | null;
  estimateOnMount?: boolean;
  onNutrition?: (value: FreshNutritionEstimate) => void;
  onStatusChange?: (status: NutritionEstimateStatus) => void;
}) {
  const [nutrition, setNutrition] = useState<FreshNutritionEstimate | null>(savedNutrition);
  const [busy, setBusy] = useState(!savedNutrition && estimateOnMount);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestBody = JSON.stringify({ title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions, servings: recipe.servings });
  useEffect(() => {
    if (attempt === 0 && (savedNutrition || !estimateOnMount)) return;
    const controller = new AbortController();
    let active = true;
    let settled = false;
    onStatusChange?.('pending');
    const fail = () => {
      if (!active || settled) return;
      settled = true; setFailed(true); setBusy(false); onStatusChange?.('failed');
    };
    const timeout = setTimeout(() => { fail(); controller.abort(); }, 45_000);
    apiRequest<FreshNutritionEstimate>('/api/nutrition/estimate', {
      method: 'POST', signal: controller.signal,
      body: requestBody,
    }).then((value) => {
      if (active && !settled) {
        settled = true; setNutrition(value); setBusy(false); onNutrition?.(value); onStatusChange?.('ready');
      }
    }).catch(fail).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [requestBody, attempt, savedNutrition, estimateOnMount, onNutrition, onStatusChange]);

  const before = isPackage ? detectAdditives(originalIngredients) : [];
  const after = isPackage ? detectAdditives(recipe.freshIngredients.join(', ')) : [];
  const readyOriginal = original && !original.reviewRequired ? original : null;
  return <>
    {isPackage ? <Card>
      <Text style={styles.heading}>What changed?</Text>
      <View style={styles.columns}>
        <View style={[styles.panel, styles.before]}>
          <Text style={styles.label}>Original package</Text>
          <Text style={styles.count}>{before.length}</Text>
          <Text style={styles.note}>matched additives</Text>
          {before.map((item) => <Text key={item.name} style={styles.body}>{item.name}</Text>)}
          {!before.length ? <Text style={styles.body}>No matches in the ingredient list.</Text> : null}
        </View>
        <View style={[styles.panel, styles.after]}>
          <Text style={styles.label}>Homemade</Text>
          <Text style={styles.count}>{after.length}</Text>
          <Text style={styles.note}>matched additives</Text>
          {after.map((item) => <Text key={item.name} style={styles.body}>{item.name}</Text>)}
          {!after.length ? <Text style={styles.body}>No matches in this recipe.</Text> : null}
        </View>
      </View>
      <Text style={styles.note}>Matches a list of common additives against the ingredient names. Check labels on the ingredients you use; no matches does not mean additive-free.</Text>
    </Card> : null}
    <Card>
      <Text style={styles.heading}>Nutrition</Text>
      {isPackage ? <Text style={styles.note}>Package: {readyOriginal ? `${readyOriginal.basisLabel} · ${readyOriginal.sourceLabel}` : original?.reviewRequired ? 'Confirm the scanned values in the ingredient review to include them here.' : 'No package Nutrition Facts were provided.'}</Text> : null}
      <Text style={styles.note}>Homemade: {nutrition?.basisLabel || 'Per recipe serving'} · estimated</Text>
      {busy ? <Text accessibilityLiveRegion="polite" style={styles.note}>Estimating homemade nutrition…</Text> : null}
      {!estimateOnMount && !nutrition && !busy && !failed ? <Text style={styles.note}>No homemade nutrition estimate was saved with this recipe.</Text> : null}
      <View style={styles.nutrient}>
        <Text style={styles.nutrientName}>Nutrient</Text>
        {isPackage ? <Text style={styles.number}>Package</Text> : null}
        <Text style={styles.number}>Homemade</Text>
      </View>
      {NUTRIENT_FIELDS.map(({ key, label, unit }) => <View key={key} style={styles.nutrient}>
        <Text style={styles.nutrientName}>{label}</Text>
        {isPackage ? <Text style={styles.number}>{readyOriginal?.values[key] == null ? '—' : `${readyOriginal.values[key]} ${unit}`}</Text> : null}
        <Text style={styles.number}>{nutrition?.[key] == null ? '—' : `${nutrition[key]} ${unit}`}</Text>
      </View>)}
      <Text style={styles.note}>Homemade values are estimates and vary with ingredients and portions.{isPackage ? ' Serving sizes may differ; these are not equal-portion comparisons.' : ''} — means unavailable.</Text>
      {failed ? <><Text style={styles.note}>Nutrition could not load. Your recipe is ready to use.</Text><Button label="Retry nutrition" secondary onPress={() => { setBusy(true); setFailed(false); setNutrition(null); onStatusChange?.('pending'); setAttempt((value) => value + 1); }} /></> : null}
    </Card>
  </>;
}

const styles = StyleSheet.create({
  heading: { color: colors.greenDark, fontSize: 21, fontWeight: '800' },
  columns: { flexDirection: 'row', gap: 10 }, column: { flex: 1, gap: 5 },
  panel: { flex: 1, borderRadius: 12, padding: 12, gap: 6 }, before: { backgroundColor: '#FFF3E5' }, after: { backgroundColor: '#EEF5EF' },
  count: { color: colors.greenDark, fontSize: 32, fontWeight: '800' },
  label: { color: colors.ink, fontWeight: '700', lineHeight: 20 }, body: { color: colors.ink, lineHeight: 20 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  nutrient: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 },
  nutrientName: { flex: 1.1, color: colors.ink, fontSize: 13 }, number: { flex: 1, textAlign: 'right', color: colors.ink, fontWeight: '600', fontSize: 13 }, review: { gap: 8 },
});

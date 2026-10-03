import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, InlineError } from './ui';
import { apiRequest } from '@/services/api';
import { adaptImportedDraft, importDraft, importSnapshot, type ImportAdaptationAction, type ImportDraft } from '@/services/recipe-import';
import { stageShoppingDraft } from '@/services/shopping-handoff';
import { colors } from '@/theme';
import { ingredientAdditives, ingredientAllergens, nutritionKey, recipeKey, scaleDetailRecipe, servingCount, type DetailRecipe } from '../../../shared/recipe-detail';
import { NUTRIENT_FIELDS, type FreshNutritionEstimate, type OriginalNutrition } from '../../../shared/nutrition-facts';
import { detectAdditives } from '../../../shared/additives';

type NutritionState = { key: string; value: FreshNutritionEstimate | null; status: 'pending' | 'ready' | 'failed' };
export type DetailSave = { recipe: DetailRecipe; nutrition: FreshNutritionEstimate | null; changed: boolean; allowLeave(): void };
type Props = {
  initial: DetailRecipe;
  originalIngredients?: string;
  packageNutrition?: OriginalNutrition | null;
  isPackage?: boolean;
  savedNutrition?: FreshNutritionEstimate | null;
  saved?: boolean;
  intro?: ReactNode;
  extra?: ReactNode;
  onSave(value: DetailSave): Promise<void>;
  onChange?: (changed: boolean) => void;
  sourceRecipe?: DetailRecipe | null;
};

export function RecipeDetail({ initial, originalIngredients = '', packageNutrition, isPackage = false, savedNutrition, saved = false, intro, extra, onSave, onChange, sourceRecipe }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [recipe, setRecipe] = useState(initial);
  const [history, setHistory] = useState<{ recipe: DetailRecipe; base: DetailRecipe; label: string }[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'substitute' | 'info' | 'custom' | 'edit' | null>(null);
  const [editDraft, setEditDraft] = useState<ImportDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [showPackage, setShowPackage] = useState(false);
  const [showMoreDiets, setShowMoreDiets] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const scaleBase = useRef(initial);
  const [nutritionCache, setNutritionCache] = useState<Record<string, FreshNutritionEstimate>>({});
  const chipScroll = useRef<ScrollView>(null);
  const chipOffset = useRef(0);
  const [chipEnd, setChipEnd] = useState(false);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const leaving = useRef(false);
  const originalKey = nutritionKey(initial);
  const key = nutritionKey(recipe);
  const changed = recipeKey(recipe) !== recipeKey(initial);
  const [nutrition, setNutrition] = useState<NutritionState>({ key: originalKey, value: savedNutrition ?? null, status: savedNutrition ? 'ready' : 'pending' });
  const count = servingCount(recipe.servings);
  const cached = nutritionCache[key] ?? (key === originalKey ? savedNutrition : null);
  const currentNutrition = cached ? { key, value: cached, status: 'ready' as const } : !count ? { key, value: null, status: 'failed' as const } : nutrition.key === key ? nutrition : { key, value: null, status: 'pending' as const };
  const matches = ingredientAllergens(recipe.freshIngredients);
  const contains = matches.filter(match => !match.possible);
  const possible = matches.filter(match => match.possible);
  const additives = ingredientAdditives(recipe.freshIngredients);

  usePreventRemove(changed || !saved || busy || saving, ({ data }) => {
    if (leaving.current) { navigation.dispatch(data.action); return; }
    if (locked.current && saving) return;
    Alert.alert('Leave this recipe?', 'Unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave', onPress: () => { request.current?.abort(); navigation.dispatch(data.action); } },
    ]);
  });

  useEffect(() => { onChange?.(changed); }, [changed, onChange]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!servingCount(recipe.servings) || Boolean(nutritionCache[key]) || (key === originalKey && savedNutrition)) return;
    const controller = new AbortController();
    let active = true;
    let settled = false;
    const fail = () => { if (active && !settled) { settled = true; setNutrition({ key, value: null, status: 'failed' }); } };
    // Debounce serving taps; changed keys hide previous numbers immediately.
    const timer = setTimeout(() => {
      apiRequest<FreshNutritionEstimate>('/api/nutrition/estimate', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions, servings: String(servingCount(recipe.servings)) }),
      }).then(value => {
        if (!active || settled) return;
        if (!value || value.perServing !== true || value.accuracy !== 'estimated' || !NUTRIENT_FIELDS.some(({ key: field }) => typeof value[field] === 'number') || NUTRIENT_FIELDS.some(({ key: field }) => value[field] != null && (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field]! < 0))) throw new Error('Invalid nutrition estimate');
        settled = true; setNutritionCache(current => ({ ...current, [key]: value })); setNutrition({ key, value, status: 'ready' });
      }).catch(fail);
    }, 400);
    const timeout = setTimeout(() => { fail(); controller.abort(); }, 50_000);
    return () => { active = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
    // The key includes every input sent to the nutrition service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, originalKey, savedNutrition, attempt]);

  const replace = (next: DetailRecipe, label: string, scaled = false) => {
    const base = scaleBase.current;
    if (!scaled) scaleBase.current = next;
    setHistory(current => [...current, { recipe, base, label }]);
    if (nutritionKey(next) !== key) setNutrition({ key: nutritionKey(next), value: null, status: 'pending' });
    setRecipe(next); setMessage(label); setError(null);
  };
  const undo = () => {
    if (locked.current || !history.length) return;
    const previous = history[history.length - 1];
    scaleBase.current = previous.base;
    if (nutritionKey(previous.recipe) !== key) setNutrition({ key: nutritionKey(previous.recipe), value: null, status: 'pending' });
    setRecipe(previous.recipe); setHistory(history.slice(0, -1)); setMessage('Change undone'); setError(null);
  };
  const adapt = async (action: ImportAdaptationAction, label: string) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setDialog(null); setMenu(null);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65_000);
    try {
      const result = await adaptImportedDraft(importDraft(recipe), action, controller.signal);
      if (!controller.signal.aborted) {
        replace(importSnapshot(importDraft(result.recipe)), label);
        if (result.reviewNotes.length) setMessage(`${label}. ${result.reviewNotes.join(' ')}`);
      }
    } catch (value) { setError(controller.signal.aborted ? 'Change canceled. Your recipe is unchanged.' : value instanceof Error ? value.message : 'Could not update the recipe.'); }
    finally { clearTimeout(timeout); request.current = null; locked.current = false; setBusy(false); }
  };
  const scale = (nextCount: number) => {
    if (locked.current) return;
    try { replace(scaleDetailRecipe(scaleBase.current, nextCount), `Changed to ${nextCount} servings. Adjust seasoning to taste; cooking times may vary.`, true); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not change servings.'); }
  };
  const save = async () => {
    if (locked.current || currentNutrition.status === 'pending') return;
    locked.current = true; setSaving(true); setError(null);
    try { await onSave({ recipe, nutrition: currentNutrition.value, changed, allowLeave: () => { leaving.current = true; } }); }
    catch (value) { leaving.current = false; setError(value instanceof Error ? value.message : 'Could not save. Your recipe is still here.'); }
    finally { locked.current = false; setSaving(false); }
  };
  const navigate = (path: '/(tabs)' | '/(tabs)/library' | '/(tabs)/shopping' | '/(tabs)/account') => {
    router.dismissTo(path);
  };
  const shop = () => {
    if (!menu) return;
    stageShoppingDraft({ title: recipe.title, ingredients: [menu] });
    setMenu(null);
    // Push preserves the unsaved recipe while the user reviews the shopping item.
    router.push('/(tabs)/shopping');
  };
  const selectedMatches = menu ? ingredientAllergens([menu]) : [];
  const selectedAdditives = menu ? ingredientAdditives([menu]) : [];

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {intro}
      <InlineError message={error} />
      <Card>
        <Text style={styles.title}>{recipe.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.muted}>{[recipe.prepTime && `${recipe.prepTime} prep`, recipe.cookTime && `${recipe.cookTime} cook`].filter(Boolean).join(' · ')}</Text>
          <View style={styles.servings}>
            <Text style={styles.body}>Servings</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Decrease servings" disabled={busy || saving || !count || count <= 1} onPress={() => count && scale(count - 1)} style={styles.touch}><Text style={styles.symbol}>−</Text></Pressable>
            <Text accessibilityLabel={`${recipe.servings} servings`} style={styles.count}>{recipe.servings || '?'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Increase servings" disabled={busy || saving || !count || count >= 100} onPress={() => count && scale(count + 1)} style={styles.touch}><Text style={styles.symbol}>+</Text></Pressable>
          </View>
        </View>
        {!count ? <Text style={styles.note}>The source does not specify a whole serving count. Edit the recipe to set it before calculating nutrition.</Text> : null}
        <Text style={styles.heading}>Ingredients</Text>
        {recipe.freshIngredients.map((ingredient, index) => <View key={`${index}-${ingredient}`} style={styles.ingredient}>
          <View style={styles.grow}><Text style={styles.body}>{ingredient}</Text>{ingredientAdditives([ingredient]).length ? <Text style={styles.note}>Listed additive: {ingredientAdditives([ingredient]).map(item => item.name).join(', ')}</Text> : null}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${ingredient}`} disabled={busy || saving} onPress={() => { setMenu(ingredient); setDialog(null); setInput(''); }} style={styles.touch}><Text style={styles.symbol}>⋮</Text></Pressable>
        </View>)}
        {message ? <View style={styles.undo}><Text accessibilityLiveRegion="polite" style={[styles.body, styles.grow]}>{message}</Text>{history.length ? <Pressable accessibilityRole="button" accessibilityLabel="Undo last recipe change" disabled={busy || saving} onPress={undo} style={styles.touch}><Text style={styles.link}>Undo</Text></Pressable> : null}</View> : null}
      </Card>
      <Card><Text style={styles.heading}>Cooking instructions</Text>{recipe.instructions.map((step, index) => <View key={`${index}-${step}`} style={styles.step}><Text style={styles.stepNumber}>{index + 1}</Text><Text style={[styles.body, styles.grow]}>{step.replace(/^\d+[.)]\s*/, '')}</Text></View>)}</Card>
      <Button label="Edit recipe details" secondary disabled={busy || saving} onPress={() => { setEditDraft(importDraft(recipe)); setEditError(null); setDialog('edit'); }} />
      <Card>
        <View style={styles.row}><Text style={styles.heading}>Nutrition</Text>{changed && currentNutrition.status === 'ready' ? <Text accessibilityLiveRegion="polite" style={styles.badge}>✓ Updated</Text> : null}</View>
        <Text style={styles.note}>Estimated per serving · based on these ingredients</Text>
        {currentNutrition.status === 'pending' ? <Text accessibilityLiveRegion="polite" style={styles.body}>Updating nutrition…</Text> : null}
        <View style={styles.metrics}>{NUTRIENT_FIELDS.slice(0, 4).map(({ key: field, label, unit }) => <View key={field} style={styles.metric}><Text style={styles.metricNumber}>{currentNutrition.value?.[field] ?? '—'}</Text><Text style={styles.note}>{unit} {label === 'Calories' ? '' : label.toLowerCase()}</Text></View>)}</View>
        <Text style={styles.note}>Fiber: {currentNutrition.value?.fiber ?? '—'} g · Sugar: unavailable · Sodium: {currentNutrition.value?.sodium ?? '—'} mg</Text>
        <Text style={styles.note}>{currentNutrition.status === 'ready' ? changed ? 'Recalculated for your current recipe.' : 'AI estimate from recipe quantities; brands and portions can vary.' : '— means unavailable. No sample values are used.'}</Text>
        {currentNutrition.status === 'failed' ? <><Text style={styles.body}>{count ? 'Nutrition could not be calculated. You can retry or save without it.' : 'Set the serving count in Edit recipe details to calculate nutrition.'}</Text>{count ? <Button label="Retry nutrition" secondary onPress={() => { setNutrition({ key, value: null, status: 'pending' }); setAttempt(value => value + 1); }} /> : null}</> : null}
      </Card>
      <Card>
        <Text style={styles.heading}>Ingredients & additives</Text>
        {additives.map((item, index) => <View key={`${index}-${item.name}`} style={styles.detail}><Text style={styles.label}>{item.name}</Text><Text style={styles.body}>{item.category}</Text><Text style={styles.note}>From ingredient: {item.ingredient}</Text></View>)}
        {!additives.length ? <Text style={styles.body}>No listed additives matched in these ingredients. Packaged ingredients may contain others; check their labels.</Text> : null}
        {isPackage && originalIngredients ? <><Button label={showPackage ? 'Hide original package label' : 'View original package label'} secondary onPress={() => setShowPackage(value => !value)} />{showPackage ? <View style={styles.detail}><Text style={styles.label}>Original package — source for the homemade recipe</Text><Text style={styles.body}>{originalIngredients}</Text>{detectAdditives(originalIngredients).map(item => <Text key={item.name} style={styles.note}>{item.name} · {item.category} · From original package label</Text>)}<Text style={styles.note}>These label ingredients are not automatically ingredients in your homemade recipe.</Text>{packageNutrition && !packageNutrition.reviewRequired ? <><Text style={styles.label}>{packageNutrition.basisLabel} · {packageNutrition.sourceLabel}</Text>{NUTRIENT_FIELDS.map(({ key: field, label, unit }) => <Text key={field} style={styles.note}>{label}: {packageNutrition.values[field] ?? '—'} {unit}</Text>)}</> : null}</View> : null}</> : null}
      </Card>
      <View accessibilityRole="summary" style={styles.allergens}>
        <Text style={styles.allergenHeading}>⚠ Recipe allergens</Text>
        {contains.length ? <><Text style={styles.allergenHeading}>This recipe contains:</Text>{contains.map((match, index) => <Text key={index} style={styles.allergenText}>{match.name} — {match.ingredient}</Text>)}</> : <Text style={styles.allergenText}>No explicit major-allergen names matched.</Text>}
        {possible.length ? <><Text style={styles.allergenHeading}>Check the label for:</Text>{possible.map((match, index) => <Text key={index} style={styles.allergenText}>{match.name} — {match.ingredient}</Text>)}</> : null}
        <Text style={styles.allergenText}>Based on ingredient names. Unlisted ingredients and cross-contact are unknown; check product labels.</Text>
      </View>
      <Card>
        <Text style={styles.heading}>Make it your way</Text><Text style={styles.note}>Updates ingredients, steps & nutrition.</Text>
        <View style={styles.row}><ScrollView horizontal ref={chipScroll} showsHorizontalScrollIndicator={false} onScroll={event => { chipOffset.current = event.nativeEvent.contentOffset.x; setChipEnd(event.nativeEvent.contentOffset.x + event.nativeEvent.layoutMeasurement.width >= event.nativeEvent.contentSize.width - 5); }} scrollEventThrottle={32} contentContainerStyle={styles.chips}>
          {['Vegan', 'Vegetarian', 'Low-carb', 'Gluten-free', 'Dairy-free'].map(diet => <Pressable key={diet} accessibilityRole="button" accessibilityLabel={`Make recipe ${diet.toLowerCase()}`} disabled={busy || saving} onPress={() => void adapt({ type: 'preferences', oneRecipeDiet: diet }, `Made recipe ${diet.toLowerCase()}`)} style={styles.chip}><Text style={styles.link}>{diet}</Text></Pressable>)}
        </ScrollView><Pressable accessibilityRole="button" accessibilityLabel={chipEnd ? 'Scroll dietary options to start' : 'Show more dietary options'} onPress={() => chipScroll.current?.scrollTo({ x: chipEnd ? 0 : chipOffset.current + 180, animated: true })} style={styles.touch}><Text style={styles.symbol}>{chipEnd ? '‹' : '›'}</Text></Pressable></View>
        <Button label={showMoreDiets ? 'Fewer options' : 'More options'} secondary disabled={busy || saving} onPress={() => setShowMoreDiets(value => !value)} />
        {showMoreDiets ? <><Button label="Keto" secondary disabled={busy || saving} onPress={() => void adapt({ type: 'preferences', oneRecipeDiet: 'Keto' }, 'Applied keto request')} /><Button label="Other changes" secondary onPress={() => { setInput(''); setDialog('custom'); }} /><Button label="Apply my saved food preferences" secondary onPress={() => void adapt({ type: 'preferences', oneRecipeDiet: '' }, 'Applied saved food preferences')} /></> : null}
        {busy ? <><Text accessibilityLiveRegion="polite" style={styles.body}>Updating the complete recipe…</Text><Button label="Cancel change" secondary onPress={() => request.current?.abort()} /></> : null}
      </Card>
      {sourceRecipe ? <Card><Button label={showSource ? 'Hide imported source' : 'Review imported source'} secondary onPress={() => setShowSource(value => !value)} />{showSource ? <><Text style={styles.heading}>{sourceRecipe.title}</Text>{sourceRecipe.freshIngredients.map((line, index) => <Text key={`i-${index}`} style={styles.body}>{line}</Text>)}{sourceRecipe.instructions.map((line, index) => <Text key={`s-${index}`} style={styles.body}>{index + 1}. {line}</Text>)}</> : null}<Button label="Restore imported source" secondary disabled={busy || saving} onPress={() => replace(sourceRecipe, 'Restored imported source')} /></Card> : null}
      {extra}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <Button label="Save recipe" loading={saving} disabled={busy || currentNutrition.status === 'pending'} onPress={() => void save()} />
      <Text style={styles.footerNote}>{currentNutrition.status === 'pending' ? 'Finishing nutrition…' : saved && changed ? 'Saves a new copy. Your original stays unchanged.' : 'Saves the recipe shown.'}</Text>
      <View style={styles.nav}>{([{ label: 'Home', icon: '⌂', path: '/(tabs)' }, { label: 'Recipes', icon: '▤', path: '/(tabs)/library' }, { label: 'Shopping', icon: '🛒', path: '/(tabs)/shopping' }, { label: 'Account', icon: '○', path: '/(tabs)/account' }] as const).map(item => <Pressable key={item.label} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.label === 'Recipes' }} disabled={busy || saving} onPress={() => navigate(item.path)} style={[styles.navItem, item.label === 'Recipes' && styles.navSelected]}><Text style={item.label === 'Recipes' ? styles.link : styles.muted}>{item.icon}</Text><Text style={item.label === 'Recipes' ? styles.link : styles.note}>{item.label}</Text></Pressable>)}</View>
    </View>
    <Modal visible={Boolean(menu) || dialog === 'custom' || dialog === 'edit'} transparent animationType="fade" onRequestClose={() => { setMenu(null); setDialog(null); }}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.modal}><ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{dialog === 'edit' ? 'Edit recipe details' : dialog === 'custom' ? 'Other changes' : menu}</Text>
        {dialog === 'edit' && editDraft ? <><Text style={styles.note}>Review ingredients and instructions together. Nutrition and allergens refresh after you apply your edits.</Text>{(['title', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servings', 'dietaryTags'] as const).map(field => <View key={field} style={{ gap: 6 }}><Text style={styles.label}>{{ title: 'Title', ingredients: 'Ingredients (one per line)', instructions: 'Instructions (one step per line)', prepTime: 'Prep time', cookTime: 'Cook time', servings: 'Servings', dietaryTags: 'Dietary tags (comma separated)' }[field]}</Text><Field accessibilityLabel={`Edit ${field}`} value={editDraft[field]} multiline={field === 'ingredients' || field === 'instructions'} style={field === 'ingredients' || field === 'instructions' ? { minHeight: 130, textAlignVertical: 'top' } : undefined} onChangeText={value => setEditDraft({ ...editDraft, [field]: value })} /></View>)}<InlineError message={editError} /><Button label="Apply edits" onPress={() => { try { const next = importSnapshot(editDraft); replace(next, 'Updated recipe details'); setDialog(null); } catch (value) { setEditError(value instanceof Error ? value.message : 'Check your recipe.'); } }} /></> : null}
        {!dialog ? <><Button label="Ingredient info" secondary onPress={() => setDialog('info')} /><Button label="Substitute" secondary onPress={() => setDialog('substitute')} /><Button label="Remove" secondary onPress={() => menu && void adapt({ type: 'remove', original: menu }, `Removed ${menu}`)} /><Button label="Add to shopping list" secondary onPress={shop} /></> : null}
        {dialog === 'info' ? <><Text style={styles.body}>Allergen matches: {selectedMatches.map(item => `${item.name}${item.possible ? ' (check label)' : ''}`).join(', ') || 'none identified from this ingredient name'}</Text>{selectedAdditives.map(item => <Text key={item.name} style={styles.body}>{item.name}: {item.category}. Source: {item.ingredient}</Text>)}<Text style={styles.note}>The recipe nutrition panel estimates the quantities used. Brand-specific nutrition and unlisted additives need the actual package label.</Text></> : null}
        {dialog === 'substitute' || dialog === 'custom' ? <><Field maxLength={dialog === 'substitute' ? 500 : 300} accessibilityLabel={dialog === 'substitute' ? 'Replacement ingredient' : 'Recipe change request'} placeholder={dialog === 'substitute' ? 'For example, unsweetened oat cream' : 'Describe your changes'} value={input} onChangeText={setInput} multiline /><Text style={styles.note}>{input.length}/{dialog === 'substitute' ? 500 : 300}</Text><Button label="Update recipe" disabled={!input.trim()} onPress={() => dialog === 'substitute' && menu ? void adapt({ type: 'substitute', original: menu, substitute: input.trim() }, `Replaced ${menu}`) : void adapt({ type: 'preferences', oneRecipeDiet: input.trim() }, 'Applied your changes')} /></> : null}
        <Button label="Close" secondary onPress={() => { setMenu(null); setDialog(null); }} />
      </ScrollView></View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream }, content: { padding: 16, gap: 14, paddingBottom: 24 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800' }, heading: { color: colors.greenDark, fontSize: 21, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 }, label: { color: colors.ink, fontSize: 16, fontWeight: '700' }, muted: { color: colors.muted, fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, metaRow: { gap: 12 }, servings: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, count: { fontSize: 18, fontWeight: '700', color: colors.ink, minWidth: 24, textAlign: 'center' },
  touch: { minHeight: 48, minWidth: 48, padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E8F5EC' }, symbol: { fontSize: 26, color: colors.green, fontWeight: '700' }, grow: { flex: 1 },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.line },
  undo: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, backgroundColor: '#E8F5EC', borderRadius: 10 }, link: { color: colors.green, fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 }, stepNumber: { color: colors.green, fontSize: 17, fontWeight: '800', width: 28, textAlign: 'center', paddingTop: 2 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { flexGrow: 1, minWidth: '40%', padding: 12, borderRadius: 10, backgroundColor: '#E8F5EC' }, metricNumber: { color: colors.greenDark, fontSize: 23, fontWeight: '800' }, badge: { color: colors.greenDark, backgroundColor: '#E8F5EC', padding: 6, borderRadius: 10, fontWeight: '700' },
  detail: { gap: 6, borderLeftWidth: 2, borderColor: colors.line, paddingLeft: 12 },
  allergens: { backgroundColor: '#FFF4D6', borderWidth: 1, borderColor: '#D89C36', borderRadius: 14, padding: 16, gap: 8 }, allergenHeading: { color: '#75450B', fontSize: 17, fontWeight: '800' }, allergenText: { color: '#75450B', lineHeight: 21 },
  chips: { gap: 8, alignItems: 'center' }, chip: { minHeight: 48, borderWidth: 1, borderColor: colors.green, borderRadius: 24, paddingHorizontal: 16, justifyContent: 'center' },
  footer: { backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 10, gap: 6 }, footerNote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  nav: { flexDirection: 'row', gap: 6 }, navItem: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12 }, navSelected: { backgroundColor: '#E8F5EC' },
  backdrop: { flex: 1, backgroundColor: '#0006', padding: 24, justifyContent: 'center' }, modal: { maxHeight: '85%', backgroundColor: colors.white, borderRadius: 20 }, modalContent: { padding: 20, gap: 14 },
});

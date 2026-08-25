import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { isValidMealPlanDate, splitPreferenceList } from '@/services/meal-plan-input';
import { useAuth } from '@/providers/auth-provider';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Plan { id: string; name: string; weekStartDate: string; description?: string | null; mealPlanRecipes: unknown[] }
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const dietaryOptions = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb', 'keto'] as const;
type MealType = typeof mealTypes[number];

function nextMondayIso() {
  const date = new Date();
  const offset = (8 - date.getDay()) % 7;
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function currentWeekMonday() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function MealPlansScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [day, setDay] = useState<typeof days[number]>('monday');
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [weekStartDate, setWeekStartDate] = useState(currentWeekMonday);
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>(['breakfast', 'lunch', 'dinner']);
  const [servings, setServings] = useState('2');
  const [calorieTarget, setCalorieTarget] = useState('');
  const [allergies, setAllergies] = useState(() => (user?.allergies ?? []).join(', '));
  const [dislikes, setDislikes] = useState(() => (user?.dislikedIngredients ?? []).join(', '));
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPlans((await apiRequest<{ mealPlans: Plan[] }>('/api/mobile/meal-plans')).mealPlans); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load meal plans.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  const toggleMealType = (value: MealType) => {
    setSelectedMealTypes((current) => mealTypes.filter((item) => item === value ? !current.includes(item) : current.includes(item)));
  };
  const toggleDietary = (value: string) => {
    setSelectedDietary((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const generate = async () => {
    const servingsValue = Number.parseInt(servings, 10);
    const calorieValue = calorieTarget.trim() ? Number.parseInt(calorieTarget, 10) : undefined;
    if (!isValidMealPlanDate(weekStartDate)) { setError('Enter the week starting date as YYYY-MM-DD.'); return; }
    if (!selectedMealTypes.length) { setError('Select at least one meal for each day.'); return; }
    if (!Number.isInteger(servingsValue) || servingsValue < 1 || servingsValue > 8) { setError('Servings must be from 1 to 8.'); return; }
    if (calorieValue !== undefined && (!Number.isInteger(calorieValue) || calorieValue < 500 || calorieValue > 10000)) {
      setError('Daily calories must be from 500 to 10,000, or left blank.'); return;
    }
    setGenerating(true); setElapsedSeconds(0); setError(null); setMessage(null);
    try {
      const plan = await apiRequest<Plan>('/api/meal-plans/generate', {
        method: 'POST',
        body: JSON.stringify({
          weekStartDate, dietaryPreferences: selectedDietary, calorieTarget: calorieValue,
          mealTypes: selectedMealTypes, mealsPerDay: selectedMealTypes.length,
          servings: servingsValue, allergies: splitPreferenceList(allergies), dislikedIngredients: splitPreferenceList(dislikes),
        }),
      });
      await load();
      router.push({ pathname: '/meal-plans/[id]', params: { id: plan.id } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not generate the weekly meal plan.'); }
    finally { setGenerating(false); setElapsedSeconds(0); }
  };

  const create = async () => {
    try {
      setError(null);
      await apiRequest('/api/mobile/meal-plans', { method: 'POST', body: JSON.stringify({ name, weekStartDate: nextMondayIso() }) });
      setName(''); await load();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not create meal plan.'); }
  };

  const choose = async (plan: Plan) => {
    if (!recipeId) { router.push({ pathname: '/meal-plans/[id]', params: { id: plan.id } }); return; }
    try {
      setError(null);
      await apiRequest(`/api/mobile/meal-plans/${plan.id}/recipes`, { method: 'POST', body: JSON.stringify({ recipeId, day, mealType, servings: 1 }) });
      setMessage(`Added to ${plan.name} on ${day}.`);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not add recipe.'); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipeId ? 'Add to meal plan' : 'Meal plans', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!recipeId ? <Card>
        <Text style={styles.sectionTitle}>Generate a seven-day meal plan</Text>
        <Text style={styles.body}>Choose exactly what you want. Your plan is checked for meal count, servings, and allergens before it is saved.</Text>
        <Text style={styles.label}>Week starting</Text>
        <Field accessibilityLabel="Week starting" placeholder="YYYY-MM-DD" value={weekStartDate} onChangeText={setWeekStartDate} autoCapitalize="none" />
        <Text style={styles.label}>Meals each day</Text>
        <View style={styles.wrap}>{mealTypes.map((value) => <Pressable key={value} onPress={() => toggleMealType(value)} style={[styles.chip, selectedMealTypes.includes(value) && styles.active]}><Text style={selectedMealTypes.includes(value) ? styles.activeText : styles.chipText}>{value}</Text></Pressable>)}</View>
        <Text style={styles.note}>Exactly {selectedMealTypes.length * 7} meals will be created for the week.</Text>
        <Text style={styles.label}>Servings per recipe</Text>
        <Field accessibilityLabel="Servings per recipe" value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="2" />
        <Text style={styles.label}>Daily calorie target (optional)</Text>
        <Field accessibilityLabel="Daily calorie target" value={calorieTarget} onChangeText={setCalorieTarget} keyboardType="number-pad" placeholder="For example, 2000" />
        <Text style={styles.label}>Allergies — never included</Text>
        <Field accessibilityLabel="Allergies" value={allergies} onChangeText={setAllergies} placeholder="Shellfish, peanuts" multiline />
        <Text style={styles.label}>Disliked ingredients — avoided</Text>
        <Field accessibilityLabel="Disliked ingredients" value={dislikes} onChangeText={setDislikes} placeholder="Cilantro, olives" multiline />
        <Text style={styles.note}>These start with your Account preferences. Changes here apply only to this plan.</Text>
        <Text style={styles.label}>Dietary preferences</Text>
        <View style={styles.wrap}>{dietaryOptions.map((value) => <Pressable key={value} onPress={() => toggleDietary(value)} style={[styles.chip, selectedDietary.includes(value) && styles.active]}><Text style={selectedDietary.includes(value) ? styles.activeText : styles.chipText}>{value}</Text></Pressable>)}</View>
        {generating ? <View style={styles.generating}><Text style={styles.generatingTitle}>Creating {selectedMealTypes.length * 7} meals · {elapsedSeconds}s elapsed</Text><Text style={styles.note}>Safety and serving checks run before anything is saved.</Text></View> : null}
        <Button label={generating ? 'Generating weekly plan…' : 'Generate weekly plan'} onPress={generate} loading={generating} disabled={!selectedMealTypes.length} />
      </Card> : <Card>
        <Text style={styles.sectionTitle}>Choose day and meal</Text>
        <View style={styles.wrap}>{days.map((value) => <Pressable key={value} onPress={() => setDay(value)} style={[styles.chip, day === value && styles.active]}><Text style={day === value ? styles.activeText : styles.chipText}>{value.slice(0, 3)}</Text></Pressable>)}</View>
        <View style={styles.wrap}>{mealTypes.map((value) => <Pressable key={value} onPress={() => setMealType(value)} style={[styles.chip, mealType === value && styles.active]}><Text style={mealType === value ? styles.activeText : styles.chipText}>{value}</Text></Pressable>)}</View>
      </Card>}
      {!recipeId ? <Card><Text style={styles.label}>Or create an empty plan</Text><Field placeholder="New meal-plan name" value={name} onChangeText={setName} /><Button label="Create next-week plan" secondary onPress={create} disabled={!name.trim() || generating} /></Card> : null}
      <InlineError message={error} />{message ? <Text style={styles.success}>{message}</Text> : null}
      {plans.map((plan) => <Pressable key={plan.id} onPress={() => choose(plan)}><Card><Text style={styles.sectionTitle}>{plan.name}</Text><Text style={styles.body}>{new Date(plan.weekStartDate).toLocaleDateString()} · {plan.mealPlanRecipes.length} meals</Text></Card></Pressable>)}
      {!plans.length ? <Text style={styles.body}>Create your first meal plan above.</Text> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' }, label: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 3 }, body: { color: colors.muted, lineHeight: 20 }, note: { color: colors.muted, fontSize: 13, lineHeight: 18 }, success: { color: colors.green, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, active: { backgroundColor: colors.green, borderColor: colors.green }, chipText: { color: colors.ink, textTransform: 'capitalize' }, activeText: { color: colors.white, fontWeight: '700', textTransform: 'capitalize' },
  generating: { borderWidth: 1, borderColor: '#A7D7BD', backgroundColor: '#EAF8F0', borderRadius: 12, padding: 12, gap: 4 }, generatingTitle: { color: colors.greenDark, fontWeight: '800' },
});

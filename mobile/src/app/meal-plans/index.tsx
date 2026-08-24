import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface Plan { id: string; name: string; weekStartDate: string; mealPlanRecipes: unknown[] }
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function nextMondayIso() {
  const date = new Date();
  const offset = (8 - date.getDay()) % 7;
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

export default function MealPlansScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [day, setDay] = useState<typeof days[number]>('monday');
  const [mealType, setMealType] = useState<typeof mealTypes[number]>('dinner');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setPlans((await apiRequest<{ mealPlans: Plan[] }>('/api/mobile/meal-plans')).mealPlans); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load meal plans.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    try {
      await apiRequest('/api/mobile/meal-plans', { method: 'POST', body: JSON.stringify({ name, weekStartDate: nextMondayIso() }) });
      setName(''); await load();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not create meal plan.'); }
  };

  const choose = async (plan: Plan) => {
    if (!recipeId) { router.push({ pathname: '/meal-plans/[id]', params: { id: plan.id } }); return; }
    try {
      await apiRequest(`/api/mobile/meal-plans/${plan.id}/recipes`, {
        method: 'POST', body: JSON.stringify({ recipeId, day, mealType, servings: 1 }),
      });
      setMessage(`Added to ${plan.name} on ${day}.`);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not add recipe.'); }
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: recipeId ? 'Add to meal plan' : 'Meal plans', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Card><Field placeholder="New meal-plan name" value={name} onChangeText={setName} /><Button label="Create next-week plan" onPress={create} disabled={!name.trim()} /></Card>
      {recipeId ? <Card>
        <Text style={styles.title}>Choose day and meal</Text>
        <View style={styles.wrap}>{days.map((value) => <Pressable key={value} onPress={() => setDay(value)} style={[styles.chip, day === value && styles.active]}><Text style={day === value ? styles.activeText : styles.chipText}>{value.slice(0, 3)}</Text></Pressable>)}</View>
        <View style={styles.wrap}>{mealTypes.map((value) => <Pressable key={value} onPress={() => setMealType(value)} style={[styles.chip, mealType === value && styles.active]}><Text style={mealType === value ? styles.activeText : styles.chipText}>{value}</Text></Pressable>)}</View>
      </Card> : null}
      <InlineError message={error} />{message ? <Text style={styles.success}>{message}</Text> : null}
      {plans.map((plan) => <Pressable key={plan.id} onPress={() => choose(plan)}><Card><Text style={styles.title}>{plan.name}</Text><Text style={styles.body}>{new Date(plan.weekStartDate).toLocaleDateString()} · {plan.mealPlanRecipes.length} meals</Text></Card></Pressable>)}
      {!plans.length ? <Text style={styles.body}>Create your first meal plan above.</Text> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' }, body: { color: colors.muted }, success: { color: colors.green, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.line }, active: { backgroundColor: colors.green }, chipText: { color: colors.ink }, activeText: { color: colors.white, fontWeight: '700' },
});

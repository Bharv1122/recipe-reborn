import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface PlanDetail { id: string; name: string; weekStartDate: string; mealPlanRecipes: { id: string; day: string; mealType: string; servings: number; recipe: { id: string; title: string } }[] }

export default function MealPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) apiRequest<{ mealPlan: PlanDetail }>(`/api/mobile/meal-plans/${id}`).then((data) => setPlan(data.mealPlan)).catch((value) => setError(value.message)); }, [id]);
  return <Screen><Stack.Screen options={{ headerShown: true, title: plan?.name || 'Meal plan', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}><InlineError message={error} />
      {plan?.mealPlanRecipes.map((entry) => <Pressable key={entry.id} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: entry.recipe.id } })}>
        <Card><Text style={styles.day}>{entry.day} · {entry.mealType}</Text><Text style={styles.title}>{entry.recipe.title}</Text><Text style={styles.body}>{entry.servings} serving{entry.servings === 1 ? '' : 's'}</Text></Card>
      </Pressable>)}
      {plan && !plan.mealPlanRecipes.length ? <Card><Text style={styles.body}>No meals added yet.</Text></Card> : null}
    </ScrollView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 30 }, day: { color: colors.orange, fontWeight: '800', textTransform: 'capitalize' }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' }, body: { color: colors.muted } });

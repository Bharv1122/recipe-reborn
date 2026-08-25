import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { Card, InlineError, Screen } from '@/components/ui';
import { colors } from '@/theme';

interface PlanEntry { id: string; day: string; mealType: string; servings: number; recipe: { id: string; title: string; prepTime?: string | null; cookTime?: string | null; calories?: number | null } }
interface PlanDetail { id: string; name: string; weekStartDate: string; description?: string | null; mealPlanRecipes: PlanEntry[] }
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function MealPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) apiRequest<{ mealPlan: PlanDetail }>(`/api/mobile/meal-plans/${id}`).then((data) => setPlan(data.mealPlan)).catch((value) => setError(value.message)); }, [id]);
  return <Screen><Stack.Screen options={{ headerShown: true, title: plan?.name || 'Meal plan', headerTintColor: colors.green }} />
    <ScrollView contentContainerStyle={styles.content}><InlineError message={error} />
      {!plan && !error ? <Card><Text style={styles.body}>Loading your weekly plan…</Text></Card> : null}
      {plan?.description ? <Card><Text style={styles.body}>{plan.description}</Text></Card> : null}
      {plan ? days.map((day) => {
        const entries = plan.mealPlanRecipes.filter((entry) => entry.day.toLowerCase() === day);
        if (!entries.length) return null;
        const dailyCalories = entries.reduce((total, entry) => total + (entry.recipe.calories || 0), 0);
        return <Card key={day}>
          <Text style={styles.day}>{day}{dailyCalories ? ` · about ${dailyCalories} cal` : ''}</Text>
          {entries.map((entry) => <Pressable key={entry.id} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: entry.recipe.id } })} style={styles.meal}>
            <Text style={styles.mealType}>{entry.mealType}</Text>
            <Text style={styles.title}>{entry.recipe.title}</Text>
            <Text style={styles.body}>{entry.servings} serving{entry.servings === 1 ? '' : 's'}{entry.recipe.calories ? ` · ${entry.recipe.calories} cal/serving` : ''}</Text>
          </Pressable>)}
        </Card>;
      }) : null}
      {plan && !plan.mealPlanRecipes.length ? <Card><Text style={styles.body}>No meals added yet.</Text></Card> : null}
    </ScrollView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 30 }, day: { color: colors.orange, fontSize: 19, fontWeight: '800', textTransform: 'capitalize' }, meal: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11, gap: 3 }, mealType: { color: colors.green, fontWeight: '800', textTransform: 'capitalize' }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 20 } });

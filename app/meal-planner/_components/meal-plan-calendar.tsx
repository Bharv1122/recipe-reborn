'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Clock, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Recipe {
  id: string;
  title: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  dietaryTags?: string[];
  calories?: number;
}

interface MealPlanRecipe {
  id: string;
  day: string;
  mealType: string;
  servings: number;
  notes?: string;
  recipe: Recipe;
}

interface MealPlan {
  id: string;
  name: string;
  weekStartDate: string;
  description: string | null;
  mealPlanRecipes: MealPlanRecipe[];
}

interface MealPlanCalendarProps {
  plan: MealPlan;
  onUpdate: () => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealPlanCalendar({ plan, onUpdate }: MealPlanCalendarProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  // Organize meals by day and type
  const mealsByDay = DAYS.reduce((acc, day) => {
    acc[day] = MEAL_TYPES.reduce((mealAcc, type) => {
      mealAcc[type] = plan.mealPlanRecipes.filter(
        (mpr) => mpr.day === day && mpr.mealType === type
      );
      return mealAcc;
    }, {} as Record<string, MealPlanRecipe[]>);
    return acc;
  }, {} as Record<string, Record<string, MealPlanRecipe[]>>);

  const handleGenerateShoppingList = async () => {
    try {
      setGenerating(true);
      const recipeIds = plan.mealPlanRecipes.map((mpr) => mpr.recipe.id);
      
      const response = await fetch('/api/shopping-lists/from-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeIds,
          name: `Shopping List - ${plan.name}`,
        }),
      });

      if (response.ok) {
        const list = await response.json();
        toast.success('Shopping list created!');
        router.push(`/shopping-lists?id=${list.id}`);
      } else {
        toast.error('Failed to create shopping list');
      }
    } catch (error) {
      console.error('Error creating shopping list:', error);
      toast.error('Failed to create shopping list');
    } finally {
      setGenerating(false);
    }
  };

  const getTotalCalories = (day: string) => {
    const dayMeals = Object.values(mealsByDay[day]).flat();
    return dayMeals.reduce((sum, mpr) => sum + (mpr.recipe.calories || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{plan.name}</CardTitle>
            <CardDescription>
              Week of {new Date(plan.weekStartDate).toLocaleDateString()}
            </CardDescription>
          </div>
          <Button
            onClick={handleGenerateShoppingList}
            disabled={generating || plan.mealPlanRecipes.length === 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Create Shopping List
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {DAYS.map((day) => {
            const totalCals = getTotalCalories(day);
            return (
              <div key={day} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{DAY_LABELS[day]}</h3>
                  {totalCals > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      ~{totalCals} cal
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MEAL_TYPES.map((mealType) => {
                    const meals = mealsByDay[day][mealType];
                    
                    return (
                      <div key={mealType} className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Utensils className="h-3 w-3" />
                          {MEAL_LABELS[mealType]}
                        </div>
                        
                        {meals.length === 0 ? (
                          <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                            No meal planned
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {meals.map((mpr) => (
                              <Card
                                key={mpr.id}
                                className="border-l-4 border-l-primary bg-secondary/50"
                              >
                                <CardContent className="p-3 space-y-1">
                                  <div className="font-medium text-sm line-clamp-2">
                                    {mpr.recipe.title}
                                  </div>
                                  
                                  {(mpr.recipe.prepTime || mpr.recipe.cookTime) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {mpr.recipe.prepTime && `Prep: ${mpr.recipe.prepTime}`}
                                        {mpr.recipe.prepTime && mpr.recipe.cookTime && ' • '}
                                        {mpr.recipe.cookTime && `Cook: ${mpr.recipe.cookTime}`}
                                      </span>
                                    </div>
                                  )}

                                  {mpr.recipe.calories && (
                                    <div className="text-xs text-muted-foreground">
                                      {mpr.recipe.calories} cal/serving
                                    </div>
                                  )}

                                  {mpr.recipe.dietaryTags && mpr.recipe.dietaryTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {mpr.recipe.dietaryTags.slice(0, 2).map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs py-0">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

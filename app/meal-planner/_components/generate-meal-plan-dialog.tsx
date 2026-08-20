'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface GenerateMealPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanGenerated: (plan: any) => void;
}

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-Free' },
  { id: 'dairy-free', label: 'Dairy-Free' },
  { id: 'low-carb', label: 'Low-Carb' },
  { id: 'keto', label: 'Keto' },
];

const MEAL_TYPE_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
] as const;

type MealType = (typeof MEAL_TYPE_OPTIONS)[number]['id'];

export function GenerateMealPlanDialog({ open, onOpenChange, onPlanGenerated }: GenerateMealPlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [calorieTarget, setCalorieTarget] = useState('');
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>([
    'breakfast',
    'lunch',
    'dinner',
  ]);
  const [servings, setServings] = useState('2');
  const [allergies, setAllergies] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Pre-fill from the profile's saved food preferences (editable per plan)
  useEffect(() => {
    if (!open || prefsLoaded) return;
    fetch('/api/user/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((prefs) => {
        if (prefs) {
          setAllergies((prefs.allergies || []).join(', '));
          setDislikes((prefs.dislikedIngredients || []).join(', '));
        }
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, [open, prefsLoaded]);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

  const splitList = (value: string) =>
    value.split(',').map((item) => item.trim()).filter(Boolean);

  const toggleDietary = (id: string) => {
    setSelectedDietary(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const toggleMealType = (mealType: MealType) => {
    setSelectedMealTypes((current) => {
      const next = current.includes(mealType)
        ? current.filter((type) => type !== mealType)
        : [...current, mealType];
      return MEAL_TYPE_OPTIONS
        .map((option) => option.id)
        .filter((type) => next.includes(type));
    });
  };

  const handleGenerate = async () => {
    if (selectedMealTypes.length === 0) {
      toast.error('Select at least one meal type.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/meal-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate,
          dietaryPreferences: selectedDietary,
          calorieTarget: calorieTarget ? parseInt(calorieTarget) : undefined,
          mealTypes: selectedMealTypes,
          mealsPerDay: selectedMealTypes.length,
          servings: parseInt(servings),
          allergies: splitList(allergies),
          dislikedIngredients: splitList(dislikes),
        }),
      });

      if (response.ok) {
        const plan = await response.json();
        onPlanGenerated(plan);
      } else {
        const error = await response.json();
        // 403 carries the Premium upsell message — show it, not a generic failure
        toast.error(error.message || error.error || 'Failed to generate meal plan', {
          duration: error.message ? 8000 : 4000,
        });
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast.error('Failed to generate meal plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate AI Meal Plan
          </DialogTitle>
          <DialogDescription>
            Create a balanced weekly meal plan tailored to your preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Week Start Date */}
          <div className="space-y-2">
            <Label htmlFor="weekStart">Week Starting</Label>
            <Input
              id="weekStart"
              type="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)}
            />
          </div>

          {/* Exact meal types and servings */}
          <div className="space-y-2">
            <Label>Meals Each Day</Label>
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
              {MEAL_TYPE_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`meal-${option.id}`}
                    checked={selectedMealTypes.includes(option.id)}
                    onCheckedChange={() => toggleMealType(option.id)}
                  />
                  <Label
                    htmlFor={`meal-${option.id}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Exactly {selectedMealTypes.length * 7} meals will be created for the week.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Servings Per Recipe</Label>
            <Input
              id="servings"
              type="number"
              min="1"
              max="8"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>

          {/* Calorie Target */}
          <div className="space-y-2">
            <Label htmlFor="calories">Daily Calorie Target (optional)</Label>
            <Input
              id="calories"
              type="number"
              placeholder="e.g., 2000"
              value={calorieTarget}
              onChange={(e) => setCalorieTarget(e.target.value)}
            />
          </div>

          {/* Allergies & Dislikes (pre-filled from Account settings) */}
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies (never included)</Label>
            <Input
              id="allergies"
              placeholder="e.g., shellfish, peanuts"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dislikes">Disliked Ingredients (avoided)</Label>
            <Input
              id="dislikes"
              placeholder="e.g., cilantro, olives"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled from your Account settings — edits here apply to this plan only.
            </p>
          </div>

          {/* Dietary Preferences */}
          <div className="space-y-2">
            <Label>Dietary Preferences</Label>
            <div className="grid grid-cols-2 gap-3">
              {DIETARY_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={selectedDietary.includes(option.id)}
                    onCheckedChange={() => toggleDietary(option.id)}
                  />
                  <Label
                    htmlFor={option.id}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">
              Creating {selectedMealTypes.length * 7} meals · {elapsedSeconds}s elapsed
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              The plan is checked for exact meal types, servings, and allergens before it is saved.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

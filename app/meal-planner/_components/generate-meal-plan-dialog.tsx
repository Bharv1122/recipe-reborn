'use client';

import { useState } from 'react';
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
  const [mealsPerDay, setMealsPerDay] = useState('3');
  const [servings, setServings] = useState('2');

  const toggleDietary = (id: string) => {
    setSelectedDietary(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meal-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate,
          dietaryPreferences: selectedDietary,
          calorieTarget: calorieTarget ? parseInt(calorieTarget) : undefined,
          mealsPerDay: parseInt(mealsPerDay),
          servings: parseInt(servings),
        }),
      });

      if (response.ok) {
        const plan = await response.json();
        onPlanGenerated(plan);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate meal plan');
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

          {/* Meals Per Day */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mealsPerDay">Meals Per Day</Label>
              <Input
                id="mealsPerDay"
                type="number"
                min="1"
                max="4"
                value={mealsPerDay}
                onChange={(e) => setMealsPerDay(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                max="8"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
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

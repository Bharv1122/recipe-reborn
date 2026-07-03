'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Calendar as CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { MealPlanCard } from './_components/meal-plan-card';
import { GenerateMealPlanDialog } from './_components/generate-meal-plan-dialog';
import { MealPlanCalendar } from './_components/meal-plan-calendar';

interface MealPlan {
  id: string;
  name: string;
  weekStartDate: string;
  description: string | null;
  createdAt: string;
  mealPlanRecipes: any[];
}

export default function MealPlannerPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchMealPlans();
    }
  }, [status, router]);

  const fetchMealPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meal-plans');
      if (response.ok) {
        const data = await response.json();
        setMealPlans(data);
        if (data.length > 0 && !selectedPlan) {
          setSelectedPlan(data[0]);
        }
      } else {
        toast.error('Failed to load meal plans');
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setGenerateDialogOpen(true);
  };

  const handlePlanGenerated = (newPlan: MealPlan) => {
    setMealPlans([newPlan, ...mealPlans]);
    setSelectedPlan(newPlan);
    setGenerateDialogOpen(false);
    toast.success('Meal plan generated successfully!');
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/meal-plans/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMealPlans(mealPlans.filter((p) => p.id !== planId));
        if (selectedPlan?.id === planId) {
          setSelectedPlan(mealPlans[0] || null);
        }
        toast.success('Meal plan deleted');
      } else {
        toast.error('Failed to delete meal plan');
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      toast.error('Failed to delete meal plan');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Meal Planner</h1>
            <p className="text-muted-foreground mt-2">
              Plan your meals for the week and generate shopping lists
            </p>
          </div>
          <Button onClick={handleCreatePlan} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Generate Meal Plan
          </Button>
        </div>

        {mealPlans.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Meal Plans Yet</CardTitle>
              <CardDescription>
                Create your first AI-generated meal plan to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCreatePlan} size="lg" className="w-full">
                <CalendarIcon className="mr-2 h-5 w-5" />
                Generate Your First Meal Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Meal Plans List */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Your Meal Plans
              </h3>
              {mealPlans.map((plan) => (
                <MealPlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlan?.id === plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  onDelete={() => handleDeletePlan(plan.id)}
                />
              ))}
            </div>

            {/* Main Content - Weekly Calendar */}
            <div className="lg:col-span-3">
              {selectedPlan && (
                <MealPlanCalendar
                  plan={selectedPlan}
                  onUpdate={fetchMealPlans}
                />
              )}
            </div>
          </div>
        )}

        {/* Generate Dialog */}
        <GenerateMealPlanDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          onPlanGenerated={handlePlanGenerated}
        />
      </div>
    </div>
  );
}

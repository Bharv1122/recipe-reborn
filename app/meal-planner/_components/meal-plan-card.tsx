import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MealPlan {
  id: string;
  name: string;
  weekStartDate: string;
  description: string | null;
  mealPlanRecipes: any[];
}

interface MealPlanCardProps {
  plan: MealPlan;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function MealPlanCard({ plan, isSelected, onClick, onDelete }: MealPlanCardProps) {
  const weekStart = new Date(plan.weekStartDate);
  const recipeCount = plan.mealPlanRecipes.length;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-primary border-2 bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base line-clamp-1">{plan.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Meal Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this meal plan. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-xs text-muted-foreground">
          {recipeCount} {recipeCount === 1 ? 'meal' : 'meals'} planned
        </div>
      </CardContent>
    </Card>
  );
}

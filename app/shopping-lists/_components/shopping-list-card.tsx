import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react';
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

interface ShoppingList {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  items: any[];
}

interface ShoppingListCardProps {
  list: ShoppingList;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function ShoppingListCard({ list, isSelected, onClick, onDelete }: ShoppingListCardProps) {
  const checkedCount = list.items.filter((item) => item.checked).length;
  const totalCount = list.items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

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
            <CardTitle className="text-base line-clamp-1 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {list.name}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {new Date(list.createdAt).toLocaleDateString()}
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
                <AlertDialogTitle>Delete Shopping List?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this shopping list and all its items.
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
        <div className="flex items-center gap-2 text-xs">
          {progress === 100 && totalCount > 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-green-600 font-medium">Complete!</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">
                {checkedCount} / {totalCount} items
              </span>
              {progress > 0 && (
                <span className="text-xs text-muted-foreground">({progress}%)</span>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

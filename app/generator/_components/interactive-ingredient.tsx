'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, RefreshCw, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Substitute {
  name: string;
  ratio: string;
  notes: string;
}

interface IngredientInfo {
  name: string;
  category: string;
  nutrition: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  healthBenefits: string[];
  substitutions: string[];
  allergens: string[];
  seasonality: string;
  storageType: string;
  shelfLife: string;
}

interface InteractiveIngredientProps {
  ingredient: string;
  index: number;
  onDelete?: (index: number) => void;
  onSubstitute?: (index: number, originalIngredient: string, newIngredient: string) => void;
  showDelete?: boolean;
  isRegenerating?: boolean;
}

export function InteractiveIngredient({
  ingredient,
  index,
  onDelete,
  onSubstitute,
  showDelete = false,
  isRegenerating = false,
}: InteractiveIngredientProps) {
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isLoadingSubstitutes, setIsLoadingSubstitutes] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showSubstituteDialog, setShowSubstituteDialog] = useState(false);
  const [ingredientInfo, setIngredientInfo] = useState<IngredientInfo | null>(null);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);

  const fetchIngredientInfo = async () => {
    setIsLoadingInfo(true);
    setShowInfoDialog(true);
    try {
      const response = await fetch('/api/ingredient-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient }),
      });

      if (!response.ok) {
        throw new Error('Failed to get ingredient info');
      }

      const data = await response.json();
      setIngredientInfo(data);
    } catch (error) {
      console.error('Error fetching ingredient info:', error);
      toast.error('Failed to get ingredient information');
      setShowInfoDialog(false);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const fetchSubstitutes = async () => {
    setIsLoadingSubstitutes(true);
    setShowSubstituteDialog(true);
    try {
      const response = await fetch('/api/ingredient-substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient }),
      });

      if (!response.ok) {
        throw new Error('Failed to get substitutes');
      }

      const data = await response.json();
      setSubstitutes(data.substitutes || []);
    } catch (error) {
      console.error('Error fetching substitutes:', error);
      toast.error('Failed to get ingredient substitutes');
      setShowSubstituteDialog(false);
    } finally {
      setIsLoadingSubstitutes(false);
    }
  };

  const handleAddToShoppingList = async () => {
    try {
      // First check if there are any shopping lists
      const listsResponse = await fetch('/api/shopping-lists');
      if (!listsResponse.ok) {
        throw new Error('Failed to fetch shopping lists');
      }
      const lists = await listsResponse.json();

      let targetListId;
      
      if (lists.length === 0) {
        // Create a new shopping list
        const createResponse = await fetch('/api/shopping-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Shopping List' }),
        });
        
        if (!createResponse.ok) {
          throw new Error('Failed to create shopping list');
        }
        
        const newList = await createResponse.json();
        targetListId = newList.id;
      } else {
        // Use the first shopping list
        targetListId = lists[0].id;
      }

      // Add ingredient to the shopping list
      const addResponse = await fetch(`/api/shopping-lists/${targetListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient,
          quantity: '1',
          category: 'Other',
        }),
      });

      if (!addResponse.ok) {
        throw new Error('Failed to add to shopping list');
      }

      toast.success(`"${ingredient}" added to shopping list!`);
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      toast.error('Failed to add to shopping list');
    }
  };

  const handleSubstitute = (substitute: Substitute) => {
    if (onSubstitute) {
      onSubstitute(index, ingredient, substitute.name);
      setShowSubstituteDialog(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(index);
      toast.success('Ingredient removed');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isRegenerating}>
          <button 
            className={`flex items-start gap-2 text-left hover:bg-gray-50 rounded-md px-2 py-1 -mx-2 transition-colors group w-full ${isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isRegenerating}
          >
            <span className="text-emerald-600 mt-1 flex-shrink-0">•</span>
            <span className="text-gray-700 group-hover:text-gray-900 flex-1">{ingredient}</span>
            {!isRegenerating && (
              <span className="text-gray-400 group-hover:text-emerald-600 mt-0.5 transition-colors">
                ⋮
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={fetchIngredientInfo} disabled={isRegenerating}>
            <Info className="mr-2 h-4 w-4" />
            <span>View Info</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={fetchSubstitutes} disabled={isRegenerating}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Find Substitute</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAddToShoppingList} disabled={isRegenerating}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            <span>Add to Shopping List</span>
          </DropdownMenuItem>
          {showDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600" disabled={isRegenerating}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ingredient Information: {ingredient}</DialogTitle>
          </DialogHeader>
          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="ml-2 text-gray-600">Loading information...</span>
            </div>
          ) : ingredientInfo ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Category</h4>
                <p className="text-gray-700">{ingredientInfo.category}</p>
              </div>

              {ingredientInfo.nutrition && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Nutrition (per 100g)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <span className="text-gray-600">Calories:</span>{' '}
                      <span className="font-semibold">{ingredientInfo.nutrition.calories}</span>
                    </div>
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <span className="text-gray-600">Protein:</span>{' '}
                      <span className="font-semibold">{ingredientInfo.nutrition.protein}g</span>
                    </div>
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <span className="text-gray-600">Carbs:</span>{' '}
                      <span className="font-semibold">{ingredientInfo.nutrition.carbs}g</span>
                    </div>
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <span className="text-gray-600">Fat:</span>{' '}
                      <span className="font-semibold">{ingredientInfo.nutrition.fat}g</span>
                    </div>
                  </div>
                </div>
              )}

              {ingredientInfo.healthBenefits?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Health Benefits</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {ingredientInfo.healthBenefits.map((benefit, i) => (
                      <li key={i} className="text-gray-700">{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ingredientInfo.substitutions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Possible Substitutes</h4>
                  <div className="flex flex-wrap gap-2">
                    {ingredientInfo.substitutions.map((sub, i) => (
                      <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ingredientInfo.allergens?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Allergens</h4>
                  <div className="flex flex-wrap gap-2">
                    {ingredientInfo.allergens.map((allergen, i) => (
                      <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                        {allergen}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Seasonality</h4>
                  <p className="text-gray-700 text-sm">{ingredientInfo.seasonality}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Storage</h4>
                  <p className="text-gray-700 text-sm">{ingredientInfo.storageType}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Shelf Life</h4>
                  <p className="text-gray-700 text-sm">{ingredientInfo.shelfLife}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Substitute Dialog */}
      <Dialog open={showSubstituteDialog} onOpenChange={setShowSubstituteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Substitute for: {ingredient}</DialogTitle>
          </DialogHeader>
          {isLoadingSubstitutes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="ml-2 text-gray-600">Finding substitutes...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-emerald-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Selecting a substitute will regenerate the entire recipe with the new ingredient!</span>
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Select a substitute to replace this ingredient:
              </p>
              {substitutes.map((sub, i) => (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleSubstitute(sub)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{sub.name}</h4>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {sub.ratio}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{sub.notes}</p>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowSubstituteDialog(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

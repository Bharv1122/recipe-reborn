'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/ui/star-rating';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Wine, Info, Loader2, Share2, Facebook, Twitter, ChefHat, MessageCircle, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RecipePresentation } from '@/components/recipe-presentation';
import { recipeComparisonSchema } from '@/lib/recipe-comparison-validation';
import type { RecipeComparisonSnapshot } from '@/shared/recipe-comparison';
import type { FreshNutritionEstimate } from '@/shared/nutrition-facts';
import { VoiceReader } from '@/components/voice-reader';
import { RecipeChat } from '@/components/recipe-chat';
import { parseStoredRecipeList } from '@/lib/recipe-list';
import { sourceHasDirections } from '@/shared/recipe-import';

interface Recipe {
  id: string;
  title: string;
  originalIngredients: string;
  freshIngredients: string;
  instructions: string;
  dietaryTags: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  rating?: number;
  notes?: string;
  winePairing?: string | null;
  estimatedCostPerServing?: number | null;
  storeBoughtCost?: number | null;
  comparisonSnapshot?: unknown;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  createdAt: string;
  librarySource?: string;
  importSourceSnapshot?: unknown;
}

interface WinePairing {
  wineType: string;
  varietal: string;
  description: string;
  servingTemp: string;
  priceRange: string;
}

interface IngredientInfo {
  name: string;
  category: string;
  nutrition: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    vitamins: string[];
  };
  healthBenefits: string[];
  substitutions: Array<{
    ingredient: string;
    ratio: string;
    note: string;
  }>;
  allergens: string[];
  seasonality: string;
  storageType: string;
  shelfLife: string;
}

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  onUpdate?: () => void;
}

export function RecipeDetailModal({ recipe, onClose, onUpdate }: RecipeDetailModalProps) {
  const initialInstructions = useMemo(() => parseStoredRecipeList(recipe?.instructions), [recipe?.instructions]);
  const [freshIngredients, setFreshIngredients] = useState<string[]>(() => parseStoredRecipeList(recipe?.freshIngredients));
  const [currentInstructions, setCurrentInstructions] = useState<string[]>(initialInstructions);
  const [draftTitle, setDraftTitle] = useState(recipe.title);
  const [draftPrepTime, setDraftPrepTime] = useState(recipe.prepTime ?? '');
  const [draftCookTime, setDraftCookTime] = useState(recipe.cookTime ?? '');
  const [draftServings, setDraftServings] = useState(recipe.servings ?? '');
  const [draftDietaryTags, setDraftDietaryTags] = useState(recipe.dietaryTags ?? []);
  const [rating, setRating] = useState(recipe?.rating ?? 0);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdaptingImport, setIsAdaptingImport] = useState(false);
  const [hasImportedAdaptation, setHasImportedAdaptation] = useState(false);
  const [adaptationNotes, setAdaptationNotes] = useState('');
  const [selectedImportIngredient, setSelectedImportIngredient] = useState(() => parseStoredRecipeList(recipe.freshIngredients)[0] ?? '');
  const [substituteInput, setSubstituteInput] = useState('');
  const [oneRecipeDiet, setOneRecipeDiet] = useState('');
  const [foodPreferences, setFoodPreferences] = useState<{ allergies: string[]; dislikedIngredients: string[]; likedIngredients: string[] } | null>(null);
  const adaptationAbort = useRef<AbortController | null>(null);

  const storedImportSourceSnapshot = useMemo(() => {
    const raw = recipe.importSourceSnapshot as Record<string, unknown> | null | undefined;
    if (raw && Array.isArray(raw.freshIngredients) && Array.isArray(raw.instructions)) {
      return {
        title: String(raw.title || recipe.title), freshIngredients: raw.freshIngredients.map(String), instructions: raw.instructions.map(String),
        prepTime: String(raw.prepTime || ''), cookTime: String(raw.cookTime || ''), servings: String(raw.servings || ''),
        dietaryTags: Array.isArray(raw.dietaryTags) ? raw.dietaryTags.map(String) : [],
      };
    }
    return null;
  }, [recipe]);
  const copySourceSnapshot = useMemo(
    () => storedImportSourceSnapshot ?? {
      title: recipe.title, freshIngredients: parseStoredRecipeList(recipe.freshIngredients), instructions: initialInstructions,
      prepTime: recipe.prepTime ?? '', cookTime: recipe.cookTime ?? '', servings: recipe.servings ?? '', dietaryTags: recipe.dietaryTags ?? [],
    },
    [recipe, initialInstructions, storedImportSourceSnapshot],
  );
  
  // Wine pairing state
  const [winePairings, setWinePairings] = useState<WinePairing[]>([]);
  const [isLoadingWine, setIsLoadingWine] = useState(false);
  const [wineLoaded, setWineLoaded] = useState(false);
  const [addingWine, setAddingWine] = useState<string | null>(null);

  // Ingredient info state
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [ingredientInfo, setIngredientInfo] = useState<IngredientInfo | null>(null);
  const [isLoadingIngredient, setIsLoadingIngredient] = useState(false);

  // Nutrition and scaling state
  const [comparison, setComparison] = useState<RecipeComparisonSnapshot | null>(() => {
    const parsed = recipeComparisonSchema.safeParse(recipe.comparisonSnapshot);
    if (parsed.success) return parsed.data;
    const hasLegacyNutrition = [recipe.calories, recipe.protein, recipe.carbs, recipe.fat, recipe.fiber, recipe.sodium].some(value => value != null);
    return hasLegacyNutrition ? { version: 1, source: 'dish', originalNutrition: null,
      freshNutrition: { calories: recipe.calories ?? null, protein: recipe.protein ?? null,
        carbs: recipe.carbs ?? null, fat: recipe.fat ?? null, fiber: recipe.fiber ?? null,
        sodium: recipe.sodium ?? null, perServing: true, accuracy: 'estimated',
        basisLabel: `Per recipe serving (recipe makes ${recipe.servings || '1'})`,
        sourceLabel: 'Saved estimate • calculation method not recorded' } } : null;
  });
  const [savedIngredients, setSavedIngredients] = useState(() => parseStoredRecipeList(recipe.freshIngredients));
  const ingredientsChanged = JSON.stringify(freshIngredients) !== JSON.stringify(savedIngredients);
  const instructionsChanged = JSON.stringify(currentInstructions) !== JSON.stringify(initialInstructions);
  const recipeContentChanged = ingredientsChanged || instructionsChanged || hasImportedAdaptation;
  const [costsInvalidated, setCostsInvalidated] = useState(false);
  const displayedComparison = recipeContentChanged && comparison ? { ...comparison, freshNutrition: null } : comparison;
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false);
  const [scaledIngredients, setScaledIngredients] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [isScaling, setIsScaling] = useState(false);

  // Load wine pairing if it exists
  useEffect(() => {
    if (recipe?.winePairing) {
      try {
        const parsed = JSON.parse(recipe.winePairing);
        setWinePairings(parsed.pairings || []);
        setWineLoaded(true);
      } catch (e) {
        console.error('Failed to parse wine pairing:', e);
      }
    }
  }, [recipe?.winePairing]);

  useEffect(() => {
    if (recipe.librarySource !== 'imported') return;
    fetch('/api/user/preferences').then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not load food preferences');
      setFoodPreferences(data);
    }).catch(() => toast.error('Could not load saved food preferences. Try again before applying them.'));
    return () => adaptationAbort.current?.abort();
  }, [recipe.librarySource]);

  useEffect(() => {
    if (!freshIngredients.includes(selectedImportIngredient)) setSelectedImportIngredient(freshIngredients[0] ?? '');
  }, [freshIngredients, selectedImportIngredient]);

  const adaptImportedRecipe = async (action: { type: 'substitute'; original: string; substitute: string } | { type: 'remove'; original: string } | { type: 'preferences'; oneRecipeDiet: string }) => {
    if (isAdaptingImport) return;
    const controller = new AbortController(); adaptationAbort.current = controller;
    setIsAdaptingImport(true);
    try {
      const response = await fetch('/api/import-recipe/adapt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          recipe: { title: draftTitle, freshIngredients, instructions: currentInstructions, prepTime: draftPrepTime,
            cookTime: draftCookTime, servings: draftServings, dietaryTags: draftDietaryTags },
          action,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'The recipe could not be adapted.');
      setDraftTitle(data.recipe.title); setFreshIngredients(data.recipe.freshIngredients); setCurrentInstructions(data.recipe.instructions);
      setDraftPrepTime(data.recipe.prepTime); setDraftCookTime(data.recipe.cookTime); setDraftServings(data.recipe.servings);
      setDraftDietaryTags(data.recipe.dietaryTags ?? []); setSubstituteInput(''); setHasImportedAdaptation(true);
      setAdaptationNotes([data.changeSummary, ...(data.reviewNotes ?? [])].filter(Boolean).join('\n'));
      setCostsInvalidated(true); setScaledIngredients(null); setScaleFactor(1);
      toast.success('Adapted copy ready to review. The saved original is unchanged.');
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'The recipe could not be adapted.');
    } finally {
      if (adaptationAbort.current === controller) adaptationAbort.current = null;
      setIsAdaptingImport(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(hasImportedAdaptation ? '/api/recipes' : `/api/recipes/${recipe?.id}`, {
        method: hasImportedAdaptation ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hasImportedAdaptation ? {
          title: draftTitle, originalIngredients: copySourceSnapshot.freshIngredients.join('\n'), freshIngredients,
          instructions: currentInstructions, dietaryTags: draftDietaryTags, prepTime: draftPrepTime, cookTime: draftCookTime,
          servings: draftServings, librarySource: 'imported', importSourceSnapshot: copySourceSnapshot,
        } : { rating, notes, freshIngredients: JSON.stringify(freshIngredients) }),
      });

      if (!response?.ok) {
        throw new Error('Failed to update recipe');
      }

      const data = await response.json();
      if (hasImportedAdaptation) {
        toast.success('Adapted copy saved. The original recipe and existing plans stayed unchanged.');
        onUpdate?.(); onClose(); return;
      }
      const parsed = recipeComparisonSchema.safeParse(data.recipe?.comparisonSnapshot);
      if (ingredientsChanged) {
        setComparison(parsed.success ? parsed.data : null);
        setCostsInvalidated(true);
        setScaledIngredients(null);
        setScaleFactor(1);
      }
      setSavedIngredients([...freshIngredients]);
      toast.success('Recipe updated successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Update recipe error:', error);
      toast.error('Failed to update recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteIngredient = (index: number) => {
    if (recipe.librarySource === 'imported') { void adaptImportedRecipe({ type: 'remove', original: freshIngredients[index] }); return; }
    const updatedIngredients = freshIngredients.filter((_, i) => i !== index);
    setFreshIngredients(updatedIngredients);
    setScaledIngredients(null);
    setScaleFactor(1);
  };

  const handleSubstituteIngredient = (index: number, originalIngredient: string, newIngredient: string) => {
    if (recipe.librarySource === 'imported') { void adaptImportedRecipe({ type: 'substitute', original: originalIngredient, substitute: newIngredient }); return; }
    const updatedIngredients = [...freshIngredients];
    updatedIngredients[index] = newIngredient;
    setFreshIngredients(updatedIngredients);
    setScaledIngredients(null);
    setScaleFactor(1);
  };

  const fetchWinePairing = async () => {
    setIsLoadingWine(true);
    try {
      const response = await fetch('/api/wine-pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName: recipe.title,
          ingredients: recipe.freshIngredients,
          dietaryTags: recipe.dietaryTags,
        }),
      });

      if (response.status === 403 || response.status === 429) {
        // Premium gate or daily AI limit: show the server's explanation instead of a generic failure.
        const body = await response.json().catch(() => null);
        toast.error(body?.message || body?.error || 'Wine pairing is a Premium feature.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to get wine pairing');
      }

      const data = await response.json();
      setWinePairings(data.pairings || []);
      setWineLoaded(true);

      // Save to recipe
      await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winePairing: JSON.stringify(data) }),
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error fetching wine pairing:', error);
      toast.error('Failed to get wine pairing');
    } finally {
      setIsLoadingWine(false);
    }
  };

  const addWineToShoppingList = async (pairing: WinePairing) => {
    setAddingWine(pairing.varietal);
    try {
      const listsResponse = await fetch('/api/shopping-lists');
      if (!listsResponse.ok) throw new Error('Failed to load shopping lists');
      const lists = await listsResponse.json();

      let listId = Array.isArray(lists) ? lists[0]?.id : undefined;
      const wineAlreadyListed = Array.isArray(lists)
        && lists.some((list) => Array.isArray(list?.items)
          && list.items.some((item: { ingredient?: string; checked?: boolean }) => (
            !item.checked
            && item.ingredient?.toLowerCase().includes(pairing.varietal.toLowerCase())
          )));
      if (wineAlreadyListed) {
        toast.success(`${pairing.varietal} is already on your shopping list.`);
        return;
      }

      if (!listId) {
        const createResponse = await fetch('/api/shopping-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${recipe.title} Shopping List`,
            notes: `Shopping list for ${recipe.title}.`,
          }),
        });
        if (!createResponse.ok) throw new Error('Failed to create shopping list');
        listId = (await createResponse.json())?.id;
      }

      if (!listId) throw new Error('Shopping list was not available');
      const addResponse = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient: pairing.varietal,
          quantity: '1',
          unit: 'bottle',
          category: 'Wine & Beverages',
          notes: 'Wine recommendation. Availability varies. Purchaser must be 21+ and show valid ID.',
        }),
      });
      if (!addResponse.ok) throw new Error('Failed to add wine');

      toast.success(`${pairing.varietal} added to your shopping list.`);
    } catch (error) {
      console.error('Error adding wine to shopping list:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add wine');
    } finally {
      setAddingWine(null);
    }
  };

  const fetchIngredientInfo = async (ingredient: string) => {
    setSelectedIngredient(ingredient);
    setIsLoadingIngredient(true);
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
    } finally {
      setIsLoadingIngredient(false);
    }
  };

  const fetchNutrition = async () => {
    setIsLoadingNutrition(true);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/nutrition`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to get nutrition info');
      }

      const data = await response.json();
      setComparison(current => ({ ...(current ?? { version: 1, source: 'dish', originalNutrition: null }), freshNutrition: data as FreshNutritionEstimate }));
      onUpdate?.();
      toast.success('Nutrition information loaded');
    } catch (error) {
      console.error('Error fetching nutrition:', error);
      toast.error('Failed to get nutrition information');
    } finally {
      setIsLoadingNutrition(false);
    }
  };

  const handleScaleRecipe = async (factor: number) => {
    setIsScaling(true);
    setScaleFactor(factor);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scaleFactor: factor }),
      });

      if (!response.ok) {
        throw new Error('Failed to scale recipe');
      }

      const data = await response.json();
      setScaledIngredients(data.scaledIngredients);
      toast.success(`Recipe scaled to ${factor}x`);
    } catch (error) {
      console.error('Error scaling recipe:', error);
      toast.error('Failed to scale recipe');
    } finally {
      setIsScaling(false);
    }
  };

  const resetScale = () => {
    setScaleFactor(1);
    setScaledIngredients(null);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="block w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto rounded-lg p-0">
        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 relative">
            <DialogTitle className="min-w-0 break-words text-xl text-gray-900 pr-12 sm:text-2xl">{recipe?.title}</DialogTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="recipe" className="w-full">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="recipe">Recipe</TabsTrigger>
                <TabsTrigger value="wine">
                  <Wine className="h-4 w-4 mr-2" />
                  Wine Pairing
                </TabsTrigger>
                <TabsTrigger value="ingredients">
                  <Info className="h-4 w-4 mr-2" />
                  Ingredient Info
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Ask AI
                </TabsTrigger>
              </TabsList>

              {/* Recipe Tab */}
              <TabsContent value="recipe" className="space-y-6 mt-6">
                {recipe.librarySource === 'imported' && <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <h3 className="font-semibold text-emerald-950">Adapt this imported recipe</h3>
                    <p className="text-sm text-emerald-900">Choose an ingredient to substitute or remove, or apply saved preferences to this recipe only. A successful result becomes a reviewable copy; the original recipe and anything already planned or shopped remain unchanged.</p>
                  </div>
                  {adaptationNotes ? <p role="status" className="whitespace-pre-line rounded-lg bg-white p-3 text-sm text-amber-900">{adaptationNotes}</p> : null}
                  <label className="block text-sm font-medium text-gray-800">Ingredient to change
                    <select className="mt-1 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3" value={selectedImportIngredient} onChange={(event) => setSelectedImportIngredient(event.target.value)} disabled={isAdaptingImport}>
                      {freshIngredients.map((ingredient) => <option key={ingredient} value={ingredient}>{ingredient}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={substituteInput} onChange={(event) => setSubstituteInput(event.target.value)} placeholder="Substitute with…" disabled={isAdaptingImport} />
                    <Button type="button" disabled={isAdaptingImport || !selectedImportIngredient || !substituteInput.trim()} onClick={() => void adaptImportedRecipe({ type: 'substitute', original: selectedImportIngredient, substitute: substituteInput.trim() })}>Substitute and update full recipe</Button>
                    <Button type="button" variant="outline" disabled={isAdaptingImport || !selectedImportIngredient} onClick={() => void adaptImportedRecipe({ type: 'remove', original: selectedImportIngredient })}>Remove and update full recipe</Button>
                  </div>
                  <div className="rounded-lg bg-white p-3 text-sm text-gray-700">
                    <p className="font-medium">Saved preferences — this recipe only</p>
                    <p>Allergies to avoid: {foodPreferences?.allergies.join(', ') || 'none saved'}</p>
                    <p>Dislikes: {foodPreferences?.dislikedIngredients.join(', ') || 'none saved'}</p>
                    <p>Likes may guide substitutes: {foodPreferences?.likedIngredients.join(', ') || 'none saved'}</p>
                    <Input className="mt-2" value={oneRecipeDiet} onChange={(event) => setOneRecipeDiet(event.target.value)} placeholder="Optional one-recipe request, e.g. vegetarian" disabled={isAdaptingImport} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={isAdaptingImport || !foodPreferences} onClick={() => void adaptImportedRecipe({ type: 'preferences', oneRecipeDiet })}>{isAdaptingImport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adapting…</> : 'Apply my preferences — this recipe only'}</Button>
                    {isAdaptingImport ? <Button type="button" variant="outline" onClick={() => adaptationAbort.current?.abort()}>Cancel adaptation</Button> : null}
                    {storedImportSourceSnapshot && sourceHasDirections(storedImportSourceSnapshot.instructions) ? <Button type="button" variant="outline" disabled={isAdaptingImport} onClick={() => {
                      setDraftTitle(storedImportSourceSnapshot.title); setFreshIngredients([...storedImportSourceSnapshot.freshIngredients]); setCurrentInstructions([...storedImportSourceSnapshot.instructions]);
                      setDraftPrepTime(storedImportSourceSnapshot.prepTime); setDraftCookTime(storedImportSourceSnapshot.cookTime); setDraftServings(storedImportSourceSnapshot.servings);
                      setDraftDietaryTags([...storedImportSourceSnapshot.dietaryTags]); setHasImportedAdaptation(true); setCostsInvalidated(true);
                      setAdaptationNotes('Restored the faithful imported source as an unsaved copy.');
                    }}>Revert copy to imported source</Button> : null}
                  </div>
                  {!storedImportSourceSnapshot ? <p className="text-xs text-amber-900">This older import has no preserved source snapshot, so source revert is unavailable. You can still review and save an adapted copy; the saved recipe remains unchanged.</p> : null}
                  <p className="text-xs text-emerald-900">Adaptations do not use another monthly recipe generation. Save creates a new recipe. Nutrition and cost estimates stay blank until recalculated for that copy. Allergy checks are bounded safeguards, not a medical guarantee.</p>
                </section>}
                <RecipePresentation
                  recipe={{ ...recipe, title: draftTitle, freshIngredients, instructions: currentInstructions, prepTime: draftPrepTime, cookTime: draftCookTime, servings: draftServings,
                    estimatedCostPerServing: recipeContentChanged || costsInvalidated ? null : recipe.estimatedCostPerServing,
                    storeBoughtCost: recipeContentChanged || costsInvalidated ? null : recipe.storeBoughtCost }}
                  dietaryTags={draftDietaryTags}
                  comparison={displayedComparison}
                  isLoadingNutrition={isLoadingNutrition}
                  onDeleteIngredient={isLoadingNutrition || isSaving ? undefined : handleDeleteIngredient}
                  onSubstituteIngredient={isLoadingNutrition || isSaving ? undefined : handleSubstituteIngredient}
                  isRegeneratingWithSubstitute={isAdaptingImport || hasImportedAdaptation}
                />
                {recipeContentChanged && <p role="status" className="text-sm text-amber-800">Recipe content changed. Save the adapted copy before calculating new nutrition or cost estimates.</p>}
                {!displayedComparison?.freshNutrition && (
                  <Button onClick={fetchNutrition} disabled={isLoadingNutrition || recipeContentChanged || isSaving} variant="outline">
                    {isLoadingNutrition ? 'Calculating estimate…' : 'Get Nutrition Info'}
                  </Button>
                )}
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Cooking tools</h3>
            {/* Cooking Mode + Read Aloud */}
            <div className="flex flex-wrap items-center gap-2">
              {!hasImportedAdaptation && <Link href={`/cooking-mode/${recipe?.id}`}>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ChefHat className="h-4 w-4 mr-2" />
                  Start Cooking Mode
                </Button>
              </Link>}
              <VoiceReader
                label="Listen to Recipe"
                getText={() =>
                  [
                    recipe?.title,
                    'Ingredients:',
                    ...freshIngredients,
                    'Instructions:',
                    ...currentInstructions.map(
                      (step: string, index: number) => `Step ${index + 1}. ${step}`
                    ),
                  ]
                    .filter(Boolean)
                    .join('. ')
                }
              />
            </div>

              {/* Recipe Scaling */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  🔢 Scale Recipe
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleScaleRecipe(0.5)}
                    disabled={isScaling || recipeContentChanged}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    0.5x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(1)}
                    disabled={isScaling || recipeContentChanged || scaleFactor === 1}
                    variant={scaleFactor === 1 ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                  >
                    1x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(2)}
                    disabled={isScaling || recipeContentChanged}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    2x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(3)}
                    disabled={isScaling || recipeContentChanged}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    3x
                  </Button>
                </div>
                {scaleFactor !== 1 && (
                  <div className="text-xs text-center mt-2 text-blue-600">
                    Scaled to {scaleFactor}x • {' '}
                    <button onClick={resetScale} className="underline hover:text-blue-700">
                      Reset
                    </button>
                  </div>
                )}
              </div>
                  {scaledIngredients && <div className="rounded-lg border p-4"><h4 className="font-semibold">Ingredients scaled to {scaleFactor}x</h4><p className="text-sm text-gray-600 mb-3">The recipe and per-serving comparison above stay unchanged.</p><ul className="space-y-2">{parseStoredRecipeList(scaledIngredients).map((ingredient, index) => <li key={index}>{ingredient}</li>)}</ul></div>}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Rating and Notes */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Rating</h3>
                    <StarRating value={rating} onChange={setRating} size="lg" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Notes</h3>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add your personal notes, cooking tips, or modifications..."
                      className="min-h-[100px] bg-white"
                    />
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSaving ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {hasImportedAdaptation ? 'Save Adapted Copy' : 'Save Changes'}
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Wine Pairing Tab */}
              <TabsContent value="wine" className="space-y-4 mt-6">
                {!wineLoaded && !isLoadingWine && (
                  <div className="text-center py-12">
                    <Wine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Get AI-Powered Wine Pairings
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Discover the perfect wines to complement this recipe
                    </p>
                    <Button
                      onClick={fetchWinePairing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Wine className="mr-2 h-4 w-4" />
                      Get Wine Recommendations
                    </Button>
                  </div>
                )}

                {isLoadingWine && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="ml-2 text-gray-600">Finding perfect wine pairings...</span>
                  </div>
                )}

                {wineLoaded && winePairings.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Recommended Wine Pairings
                    </h3>
                    {winePairings.map((pairing, index) => (
                      <Card key={index} className="border border-gray-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-lg text-gray-900">
                                {pairing.varietal}
                              </h4>
                              <p className="text-sm text-gray-600">{pairing.wineType}</p>
                            </div>
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              {pairing.priceRange}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-3">{pairing.description}</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="mb-3 w-full"
                            onClick={() => addWineToShoppingList(pairing)}
                            disabled={addingWine === pairing.varietal}
                          >
                            {addingWine === pairing.varietal ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding wine...</>
                            ) : (
                              <><ShoppingCart className="mr-2 h-4 w-4" /> Add wine to shopping list (21+)</>
                            )}
                          </Button>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>🌡️ {pairing.servingTemp}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button
                      onClick={fetchWinePairing}
                      variant="outline"
                      className="w-full"
                    >
                      Get New Recommendations
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Ingredient Info Tab */}
              <TabsContent value="ingredients" className="space-y-4 mt-6">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    💡 Tip: Click on any ingredient above to view info, find substitutes, or add to your shopping list!
                  </p>

                  {isLoadingIngredient && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                      <span className="ml-2 text-gray-600">Loading ingredient information...</span>
                    </div>
                  )}

                  {ingredientInfo && !isLoadingIngredient && (
                    <div className="space-y-4">
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50">
                          <CardTitle className="text-xl">{ingredientInfo.name}</CardTitle>
                          <p className="text-sm text-gray-600">{ingredientInfo.category}</p>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          {/* Nutrition */}
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Nutrition (per 100g)</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Calories: {ingredientInfo.nutrition.calories}</div>
                              <div>Protein: {ingredientInfo.nutrition.protein}</div>
                              <div>Carbs: {ingredientInfo.nutrition.carbs}</div>
                              <div>Fat: {ingredientInfo.nutrition.fat}</div>
                              <div>Fiber: {ingredientInfo.nutrition.fiber}</div>
                            </div>
                            {ingredientInfo.nutrition.vitamins.length > 0 && (
                              <p className="text-sm text-gray-600 mt-2">
                                Rich in: {ingredientInfo.nutrition.vitamins.join(', ')}
                              </p>
                            )}
                          </div>

                          {/* Health Benefits */}
                          {ingredientInfo.healthBenefits.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">Health Benefits</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                {ingredientInfo.healthBenefits.map((benefit, idx) => (
                                  <li key={idx}>{benefit}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Substitutions */}
                          {ingredientInfo.substitutions.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">Substitutions</h4>
                              <div className="space-y-2">
                                {ingredientInfo.substitutions.map((sub, idx) => (
                                  <div key={idx} className="text-sm">
                                    <span className="font-medium text-emerald-600">
                                      {sub.ingredient}
                                    </span>
                                    <span className="text-gray-600"> ({sub.ratio})</span>
                                    {sub.note && (
                                      <p className="text-gray-600 text-xs mt-1">{sub.note}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Allergens */}
                          {ingredientInfo.allergens.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">Allergens</h4>
                              <p className="text-sm text-red-600">
                                {ingredientInfo.allergens.join(', ')}
                              </p>
                            </div>
                          )}

                          {/* Storage & Seasonality */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-1">Seasonality</h4>
                              <p className="text-gray-700">{ingredientInfo.seasonality}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-1">Storage</h4>
                              <p className="text-gray-700">{ingredientInfo.storageType}</p>
                              <p className="text-gray-600 text-xs mt-1">
                                Shelf life: {ingredientInfo.shelfLife}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {!selectedIngredient && !isLoadingIngredient && (
                    <div className="text-center py-8 text-gray-500">
                      Select an ingredient above to view detailed information
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Ask AI Tab */}
              <TabsContent value="chat" className="mt-6">
                <RecipeChat
                  recipe={{
                    title: draftTitle,
                    ingredients: freshIngredients,
                    instructions: currentInstructions,
                    prepTime: draftPrepTime,
                    cookTime: draftCookTime,
                    servings: draftServings,
                    dietaryTags: draftDietaryTags,
                  }}
                />
              </TabsContent>
            </Tabs>

            {/* Social Sharing Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share This Recipe
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/share/${recipe?.id}`;
                    const text = `Check out this amazing recipe: ${recipe?.title}`;
                    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                    window.open(shareUrl, '_blank', 'width=600,height=400');
                  }}
                  className="flex items-center gap-2"
                >
                  <Facebook className="h-4 w-4" />
                  Facebook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/share/${recipe?.id}`;
                    const text = `Check out this amazing recipe: ${recipe?.title}`;
                    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                    window.open(shareUrl, '_blank', 'width=600,height=400');
                  }}
                  className="flex items-center gap-2"
                >
                  <Twitter className="h-4 w-4" />
                  Twitter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/share/${recipe?.id}`;
                    const description = `${recipe?.title} - Made with RecipeReborn`;
                    // Pinterest requires an image URL - we'll use the OG image
                    const imageUrl = `${window.location.origin}/og-image.png`;
                    const shareUrl = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(description)}&media=${encodeURIComponent(imageUrl)}`;
                    window.open(shareUrl, '_blank', 'width=750,height=550');
                  }}
                  className="flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                  </svg>
                  Pinterest
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const url = `${window.location.origin}/share/${recipe?.id}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.success('Link copied to clipboard!');
                    } catch (error) {
                      toast.error('Failed to copy link');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Copy Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

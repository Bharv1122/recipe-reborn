'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/ui/star-rating';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Clock, Users, Save, Wine, Info, Loader2, Share2, Facebook, Twitter } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { InteractiveIngredient } from '@/app/generator/_components/interactive-ingredient';

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
  createdAt: string;
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
  const instructions = JSON.parse(recipe?.instructions ?? '[]');
  const [freshIngredients, setFreshIngredients] = useState<string[]>(JSON.parse(recipe?.freshIngredients ?? '[]'));
  const [rating, setRating] = useState(recipe?.rating ?? 0);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  
  // Wine pairing state
  const [winePairings, setWinePairings] = useState<WinePairing[]>([]);
  const [isLoadingWine, setIsLoadingWine] = useState(false);
  const [wineLoaded, setWineLoaded] = useState(false);

  // Ingredient info state
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [ingredientInfo, setIngredientInfo] = useState<IngredientInfo | null>(null);
  const [isLoadingIngredient, setIsLoadingIngredient] = useState(false);

  // Nutrition and scaling state
  const [nutrition, setNutrition] = useState<any>(null);
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false);
  const [scaledIngredients, setScaledIngredients] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [isScaling, setIsScaling] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e?.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/recipes/${recipe?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rating, 
          notes,
          freshIngredients: JSON.stringify(freshIngredients),
        }),
      });

      if (!response?.ok) {
        throw new Error('Failed to update recipe');
      }

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
    const updatedIngredients = freshIngredients.filter((_, i) => i !== index);
    setFreshIngredients(updatedIngredients);
  };

  const handleSubstituteIngredient = (index: number, newIngredient: string) => {
    const updatedIngredients = [...freshIngredients];
    updatedIngredients[index] = newIngredient;
    setFreshIngredients(updatedIngredients);
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
      setNutrition(data);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-4xl w-full my-8">
        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 relative">
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
            <CardTitle className="text-2xl text-gray-900 pr-12">{recipe?.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="recipe" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recipe">Recipe</TabsTrigger>
                <TabsTrigger value="wine">
                  <Wine className="h-4 w-4 mr-2" />
                  Wine Pairing
                </TabsTrigger>
                <TabsTrigger value="ingredients">
                  <Info className="h-4 w-4 mr-2" />
                  Ingredient Info
                </TabsTrigger>
              </TabsList>

              {/* Recipe Tab */}
              <TabsContent value="recipe" className="space-y-6 max-h-[60vh] overflow-y-auto mt-6">
            {/* Recipe Meta Info */}
            <div className="flex items-center gap-6 text-sm text-gray-600">
              {recipe?.prepTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Prep: {recipe?.prepTime}</span>
                </div>
              )}
              {recipe?.cookTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Cook: {recipe?.cookTime}</span>
                </div>
              )}
              {recipe?.servings && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Servings: {recipe?.servings}</span>
                </div>
              )}
            </div>

            {/* Dietary Tags */}
            {recipe?.dietaryTags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipe?.dietaryTags?.map?.((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Nutrition & Scaling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              {/* Nutrition Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  📊 Nutrition (per serving)
                </h3>
                {!nutrition ? (
                  <Button
                    onClick={fetchNutrition}
                    disabled={isLoadingNutrition}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isLoadingNutrition ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Get Nutrition Info'
                    )}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {nutrition.calories && (
                      <div className="bg-white rounded px-2 py-1">
                        <span className="text-gray-600">Calories:</span>{' '}
                        <span className="font-semibold">{nutrition.calories}</span>
                      </div>
                    )}
                    {nutrition.protein && (
                      <div className="bg-white rounded px-2 py-1">
                        <span className="text-gray-600">Protein:</span>{' '}
                        <span className="font-semibold">{nutrition.protein}g</span>
                      </div>
                    )}
                    {nutrition.carbs && (
                      <div className="bg-white rounded px-2 py-1">
                        <span className="text-gray-600">Carbs:</span>{' '}
                        <span className="font-semibold">{nutrition.carbs}g</span>
                      </div>
                    )}
                    {nutrition.fat && (
                      <div className="bg-white rounded px-2 py-1">
                        <span className="text-gray-600">Fat:</span>{' '}
                        <span className="font-semibold">{nutrition.fat}g</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recipe Scaling */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  🔢 Scale Recipe
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleScaleRecipe(0.5)}
                    disabled={isScaling}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    0.5x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(1)}
                    disabled={isScaling || scaleFactor === 1}
                    variant={scaleFactor === 1 ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                  >
                    1x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(2)}
                    disabled={isScaling}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    2x
                  </Button>
                  <Button
                    onClick={() => handleScaleRecipe(3)}
                    disabled={isScaling}
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
            </div>

            {/* Ingredients */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Fresh Ingredients
                {scaledIngredients && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    (Scaled to {scaleFactor}x)
                  </span>
                )}
              </h3>
              <ul className="space-y-1">
                {(scaledIngredients ? scaledIngredients.split('\n') : freshIngredients)?.map?.((ingredient: string, index: number) => (
                  <li key={index}>
                    <InteractiveIngredient
                      ingredient={ingredient}
                      index={index}
                      onDelete={!scaledIngredients ? handleDeleteIngredient : undefined}
                      onSubstitute={!scaledIngredients ? handleSubstituteIngredient : undefined}
                      showDelete={!scaledIngredients}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h3>
              <ol className="space-y-3">
                {instructions?.map?.((instruction: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 pt-0.5">{instruction}</span>
                  </li>
                ))}
              </ol>
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
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Wine Pairing Tab */}
              <TabsContent value="wine" className="space-y-4 max-h-[60vh] overflow-y-auto mt-6">
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
              <TabsContent value="ingredients" className="space-y-4 max-h-[60vh] overflow-y-auto mt-6">
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
      </div>
    </div>
  );
}
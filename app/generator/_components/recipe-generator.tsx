'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ChefHat, Sparkles, Save, Clock, Users, Link as LinkIcon, Camera, Upload, X, Mic, PiggyBank, ScanBarcode, AlertTriangle, Leaf, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { InteractiveIngredient } from './interactive-ingredient';
import { VoiceChat } from './voice-chat';
import { BarcodeScanner } from './barcode-scanner';
import { detectAdditives, type DetectedAdditive } from '@/lib/additives';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Recipe {
  title: string;
  freshIngredients: string[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  estimatedCostPerServing?: number;
  storeBoughtCost?: number;
}

interface DietaryButton {
  label: string;
  value: string;
}

const dietaryButtons: DietaryButton[] = [
  { label: 'Make it Vegan', value: 'vegan' },
  { label: 'Make it Keto', value: 'keto' },
  { label: 'Make it Gluten-Free', value: 'gluten-free' },
  { label: 'Make it Paleo', value: 'paleo' },
  { label: 'Make it Low-Carb', value: 'low-carb' },
];

export function RecipeGenerator() {
  const [ingredients, setIngredients] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedDietaryTags, setAppliedDietaryTags] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [inputMode, setInputMode] = useState<'label' | 'pantry'>('label');
  const [isRegeneratingWithSubstitute, setIsRegeneratingWithSubstitute] = useState(false);
  const [substitutionInfo, setSubstitutionInfo] = useState<{original: string; substitute: string} | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [customCustomization, setCustomCustomization] = useState('');
  // Additives found in the ORIGINAL processed ingredients — powers the
  // before/after transformation reveal. Empty for pantry / fresh input.
  const [detectedAdditives, setDetectedAdditives] = useState<DetectedAdditive[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const isBusy = isGenerating || isExtracting;

  // Progressive loading theater — cycle status messages so the 15-30s wait
  // feels alive instead of a frozen spinner
  const loadingMessages = [
    isExtracting ? 'Reading the label…' : 'Reading the ingredients…',
    detectedAdditives.length > 0
      ? `Found ${detectedAdditives.length} additive${detectedAdditives.length === 1 ? '' : 's'} to leave behind…`
      : 'Choosing whole-food ingredients…',
    'Designing your fresh version…',
    'Calculating your savings…',
    'Plating it up…',
  ];

  useEffect(() => {
    if (!isBusy) {
      setLoadingStep(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, loadingMessages.length - 1));
    }, 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusy]);

  // Bring the finished recipe into view — on phones it renders below the fold
  useEffect(() => {
    if (recipe) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [recipe]);

  const generateRecipe = async (dietaryRestriction?: string) => {
    if (!ingredients?.trim() && !dietaryRestriction) {
      toast.error('Please enter some ingredients');
      return;
    }

    // Snapshot the additives in the original product before we transform it —
    // skip for pantry mode (nothing to "leave behind" from fresh ingredients)
    if (!dietaryRestriction) {
      setDetectedAdditives(inputMode === 'pantry' ? [] : detectAdditives(ingredients));
    }

    setIsGenerating(true);
    setRecipe(null);

    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: ingredients || recipe?.title,
          dietaryRestriction,
          source: inputMode,
        }),
      });

      if (!response?.ok) {
        // Surface the real reason — especially the free-tier limit message
        const data = await response.json().catch(() => null);
        if (response.status === 403 && data?.message) {
          toast.error(data.message, { duration: 8000 });
          return;
        }
        throw new Error(data?.error ?? 'Failed to generate recipe');
      }

      const reader = response?.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';

      while (true) {
        const result = await reader?.read();
        if (result?.done) break;

        partialRead += decoder.decode(result?.value, { stream: true });
        let lines = partialRead?.split('\n') ?? [];
        partialRead = lines?.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith('data: ')) {
            const data = line?.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed?.status === 'completed') {
                setRecipe(parsed?.result);
                if (dietaryRestriction) {
                  setAppliedDietaryTags((prev) => [...(prev ?? []), dietaryRestriction]);
                }
                toast.success('Recipe generated successfully!');
                setShowSavePrompt(true); // Show save prompt after generation
                return;
              } else if (parsed?.status === 'error') {
                throw new Error(parsed?.message ?? 'Generation failed');
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Generate recipe error:', error);
      toast.error(error?.message || 'Failed to generate recipe');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveRecipe = async () => {
    if (!recipe) return;

    setIsSaving(true);
    setShowSavePrompt(false); // Close the prompt dialog

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: recipe?.title,
          originalIngredients: ingredients,
          freshIngredients: recipe?.freshIngredients,
          instructions: recipe?.instructions,
          dietaryTags: appliedDietaryTags,
          prepTime: recipe?.prepTime,
          cookTime: recipe?.cookTime,
          servings: recipe?.servings,
          estimatedCostPerServing: recipe?.estimatedCostPerServing,
          storeBoughtCost: recipe?.storeBoughtCost,
        }),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? 'Failed to save recipe');
      }

      toast.success('Recipe saved successfully!');
    } catch (error) {
      console.error('Save recipe error:', error);
      toast.error('Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const importRecipe = async () => {
    if (!recipeUrl?.trim()) {
      toast.error('Please enter a recipe URL');
      return;
    }

    setIsImporting(true);
    setRecipe(null);

    try {
      const response = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: recipeUrl }),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? 'Failed to import recipe');
      }

      const data = await response.json();
      setRecipe(data.recipe);
      setIngredients(data.recipe.originalIngredients);
      
      // Set dietary tags if any
      if (data.recipe.dietaryTags?.length > 0) {
        setAppliedDietaryTags(data.recipe.dietaryTags);
      }

      toast.success('Recipe imported successfully!');
      setShowSavePrompt(true); // Show save prompt after import
    } catch (error: any) {
      console.error('Import recipe error:', error);
      toast.error(error?.message || 'Failed to import recipe');
    } finally {
      setIsImporting(false);
    }
  };

  // Downscale big phone photos client-side: Vercel rejects request bodies
  // over ~4.5MB, and a 1600px JPEG is plenty for label OCR
  const compressImage = (file: File): Promise<File> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1600;
        let { width, height } = img;
        if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) =>
            resolve(
              blob && blob.size < file.size
                ? new File([blob], 'label.jpg', { type: 'image/jpeg' })
                : file
            ),
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file); // browser can't decode it (e.g., HEIC in Chrome) — send as-is
      };
      img.src = url;
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 20MB pre-compression)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image size must be less than 20MB');
      return;
    }

    const upload = file.size > 1.5 * 1024 * 1024 ? await compressImage(file) : file;
    setSelectedImage(upload);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(upload);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const extractRecipeFromPhoto = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setIsExtracting(true);
    setRecipe(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/extract-recipe-from-photo', {
        method: 'POST',
        body: formData,
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? 'Failed to extract recipe from photo');
      }

      const data = await response.json();
      
      // Check if this is an ingredient list or a complete recipe
      if (data.type === 'ingredient_list') {
        // For product labels, extract ingredients and immediately generate a recipe
        const extractedIngredients = data.ingredients.join(', ');
        setIngredients(extractedIngredients);
        // Snapshot the additives on this label for the transformation reveal
        setDetectedAdditives(detectAdditives(extractedIngredients));
        clearImage(); // Clear the photo preview

        toast.success('Ingredients detected! Generating your fresh recipe...', { duration: 3000 });
        
        // Automatically generate a recipe with the extracted ingredients
        setIsExtracting(false); // Stop extraction loading
        setIsGenerating(true); // Start generation loading
        
        try {
          const generateResponse = await fetch('/api/generate-recipe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ingredients: extractedIngredients,
            }),
          });

          if (!generateResponse?.ok) {
            const errData = await generateResponse.json().catch(() => null);
            if (generateResponse.status === 403 && errData?.message) {
              toast.error(errData.message, { duration: 8000 });
              return;
            }
            throw new Error(errData?.error ?? 'Failed to generate recipe');
          }

          const reader = generateResponse?.body?.getReader();
          const decoder = new TextDecoder();
          let partialRead = '';

          while (true) {
            const result = await reader?.read();
            if (result?.done) break;

            partialRead += decoder.decode(result?.value, { stream: true });
            let lines = partialRead?.split('\n') ?? [];
            partialRead = lines?.pop() ?? '';

            for (const line of lines) {
              if (line?.startsWith('data: ')) {
                const lineData = line?.slice(6);
                if (lineData === '[DONE]') {
                  return;
                }
                try {
                  const parsed = JSON.parse(lineData);
                  if (parsed?.status === 'completed') {
                    setRecipe(parsed?.result);
                    toast.success('Fresh recipe created from your photo!');
                    setShowSavePrompt(true); // Show save prompt after photo-based generation
                    return;
                  } else if (parsed?.status === 'error') {
                    throw new Error(parsed?.message ?? 'Generation failed');
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (genError) {
          console.error('Generate recipe error:', genError);
          toast.error('Failed to generate recipe from extracted ingredients');
        } finally {
          setIsGenerating(false);
        }
      } else {
        // For complete recipes, display the full recipe
        const extractedRecipe: Recipe = {
          title: data.title,
          freshIngredients: data.ingredients,
          instructions: data.instructions,
          prepTime: data.prepTime,
          cookTime: data.cookTime,
          servings: data.servings?.toString() || '4',
        };

        setRecipe(extractedRecipe);
        
        // Set ingredients for potential re-generation
        setIngredients(data.ingredients.join(', '));
        
        // Set dietary tags if any
        if (data.dietaryTags?.length > 0) {
          setAppliedDietaryTags(data.dietaryTags);
        }

        toast.success('Recipe extracted successfully!');
        setShowSavePrompt(true); // Show save prompt after extracting complete recipe
      }
    } catch (error: any) {
      console.error('Extract recipe error:', error);
      toast.error(error?.message || 'Failed to extract recipe from photo');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteIngredient = (index: number) => {
    if (!recipe) return;
    
    const updatedIngredients = recipe.freshIngredients.filter((_, i) => i !== index);
    setRecipe({
      ...recipe,
      freshIngredients: updatedIngredients,
    });
  };

  const handleSubstituteIngredient = async (index: number, originalIngredient: string, newIngredient: string) => {
    if (!recipe) return;
    
    setIsRegeneratingWithSubstitute(true);
    setSubstitutionInfo({ original: originalIngredient, substitute: newIngredient });

    try {
      // Build the substitution context for regeneration
      const substitutionContext = `
        Original Recipe: ${recipe.title}
        
        Original Ingredients:
        ${recipe.freshIngredients.join('\n')}
        
        Original Instructions:
        ${recipe.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}
        
        SUBSTITUTION REQUEST:
        Replace "${originalIngredient}" with "${newIngredient}"
        
        Please regenerate the entire recipe adapting all ingredients and instructions to work with the substitute.
      `;

      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: substitutionContext,
          isSubstitutionRegeneration: true,
          originalRecipe: {
            title: recipe.title,
            ingredients: recipe.freshIngredients,
            instructions: recipe.instructions,
          },
          substitution: {
            original: originalIngredient,
            substitute: newIngredient,
          },
        }),
      });

      if (!response?.ok) {
        throw new Error('Failed to regenerate recipe with substitution');
      }

      const reader = response?.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';

      while (true) {
        const result = await reader?.read();
        if (result?.done) break;

        partialRead += decoder.decode(result?.value, { stream: true });
        let lines = partialRead?.split('\n') ?? [];
        partialRead = lines?.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith('data: ')) {
            const data = line?.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed?.status === 'completed') {
                setRecipe(parsed?.result);
                toast.success(`Recipe regenerated with ${newIngredient}!`, { duration: 4000 });
                return;
              } else if (parsed?.status === 'error') {
                throw new Error(parsed?.message ?? 'Regeneration failed');
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Substitute ingredient error:', error);
      toast.error('Failed to regenerate recipe with substitution');
    } finally {
      setIsRegeneratingWithSubstitute(false);
      setSubstitutionInfo(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-emerald-600" />
            Generate or Import Recipes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full h-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-4">
              <TabsTrigger value="generate">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate from Ingredients
              </TabsTrigger>
              <TabsTrigger value="voice">
                <Mic className="h-4 w-4 mr-2" />
                Voice Chat
              </TabsTrigger>
              <TabsTrigger value="import">
                <LinkIcon className="h-4 w-4 mr-2" />
                Import from URL
              </TabsTrigger>
              <TabsTrigger value="photo">
                <Camera className="h-4 w-4 mr-2" />
                Photo Upload
              </TabsTrigger>
              <TabsTrigger value="barcode">
                <ScanBarcode className="h-4 w-4 mr-2" />
                Scan Barcode
              </TabsTrigger>
            </TabsList>

            {/* Generate Tab */}
            <TabsContent value="generate" className="space-y-4">
              {/* Input mode: food label vs pantry */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setInputMode('label')}
                  disabled={isGenerating}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    inputMode === 'label'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  From a Food Label
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('pantry')}
                  disabled={isGenerating}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    inputMode === 'pantry'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  From My Pantry
                </button>
              </div>
              <Textarea
                placeholder={
                  inputMode === 'pantry'
                    ? "What's in your fridge or pantry?\nExample: chicken thighs, spinach, rice, eggs, cheddar cheese, garlic..."
                    : 'Enter ingredients from your processed food package...\nExample: enriched flour, sugar, palm oil, artificial flavoring, etc.'
                }
                value={ingredients}
                onChange={(e) => setIngredients(e?.target?.value ?? '')}
                rows={6}
                className="resize-none"
                disabled={isGenerating}
              />
              <Button
                onClick={() => generateRecipe()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isGenerating || !ingredients?.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Recipe...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {inputMode === 'pantry' ? 'Cook From What I Have' : 'Generate Fresh Recipe'}
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Voice Chat Tab */}
            <TabsContent value="voice" className="space-y-4">
              <VoiceChat
                onIngredientExtracted={(extractedIngredients) => {
                  setIngredients(extractedIngredients);
                  setActiveTab('generate');
                }}
              />
            </TabsContent>

            {/* Barcode Scanner Tab */}
            <TabsContent value="barcode" className="space-y-4">
              <BarcodeScanner
                onIngredientsExtracted={(extractedIngredients) => {
                  setIngredients(extractedIngredients);
                  setActiveTab('generate');
                }}
              />
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Recipe URL
                </label>
                <Input
                  type="url"
                  placeholder="https://www.example.com/recipe"
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e?.target?.value ?? '')}
                  disabled={isImporting}
                />
                <p className="text-xs text-gray-500">
                  Paste a link from popular recipe websites like AllRecipes, Food Network, etc.
                </p>
              </div>
              <Button
                onClick={importRecipe}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isImporting || !recipeUrl?.trim()}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing Recipe...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Import Recipe
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Photo Tab */}
            <TabsContent value="photo" className="space-y-4">
              <div className="space-y-4">
                {/* Image Preview or Upload Area */}
                {!imagePreview ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Snap to Recipe
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Take a photo of any ingredient label or product packaging, and we&apos;ll create a fresh recipe for you!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button
                        type="button"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => document.getElementById('photo-camera')?.click()}
                        disabled={isExtracting || isGenerating}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        disabled={isExtracting || isGenerating}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Photo
                      </Button>
                    </div>
                    {/* capture forces the camera on phones; the plain input allows gallery/files */}
                    <input
                      id="photo-camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-400 mt-4">
                      Supports JPG, PNG, HEIC. Max size 10MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={imagePreview}
                        alt="Recipe preview"
                        className="w-full h-auto max-h-96 object-contain bg-gray-50"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={clearImage}
                        disabled={isExtracting || isGenerating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => document.getElementById('photo-recamera')?.click()}
                        disabled={isExtracting || isGenerating}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Retake Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => document.getElementById('photo-reupload')?.click()}
                        disabled={isExtracting || isGenerating}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Different Photo
                      </Button>
                      <input
                        id="photo-recamera"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <input
                        id="photo-reupload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <Button
                        onClick={extractRecipeFromPhoto}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isExtracting || isGenerating}
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Reading Ingredients...
                          </>
                        ) : isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Recipe...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Recipe
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progressive loading theater — keeps the wait alive */}
      {isBusy && !recipe && (
        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="py-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-full border-4 border-emerald-100" />
                <Loader2 className="h-14 w-14 text-emerald-600 animate-spin absolute inset-0" />
                <Sparkles className="h-6 w-6 text-orange-500 absolute inset-0 m-auto" />
              </div>
              <p className="text-lg font-medium text-gray-900 transition-all">
                {loadingMessages[loadingStep]}
              </p>
              <div className="flex gap-1.5">
                {loadingMessages.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i <= loadingStep ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipe Display */}
      {recipe && (
        <Card ref={resultRef} className="shadow-lg border-0 bg-white scroll-mt-4">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl text-gray-900">{recipe?.title}</CardTitle>
              <Button
                onClick={saveRecipe}
                variant="outline"
                disabled={isSaving}
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Recipe
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Transformation Reveal — the before/after that IS the brand */}
            {detectedAdditives.length > 0 && (
              <div className="rounded-xl border border-emerald-200 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 via-white to-emerald-50 px-4 py-3 border-b border-emerald-100">
                  <p className="text-center text-sm font-semibold text-gray-700">
                    ✨ You just transformed a processed product into real food
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch">
                  {/* BEFORE */}
                  <div className="p-4 bg-red-50/60">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                        The packaged version
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 mb-2">
                      {detectedAdditives.length} additive{detectedAdditives.length === 1 ? '' : 's'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedAdditives.slice(0, 6).map((a) => (
                        <span
                          key={a.name}
                          title={a.concern}
                          className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium"
                        >
                          {a.name}
                        </span>
                      ))}
                      {detectedAdditives.length > 6 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          +{detectedAdditives.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center py-2 sm:px-2 bg-white">
                    <div className="bg-emerald-100 rounded-full p-2">
                      <ArrowRight className="h-5 w-5 text-emerald-600 rotate-90 sm:rotate-0" />
                    </div>
                  </div>

                  {/* AFTER */}
                  <div className="p-4 bg-emerald-50/60">
                    <div className="flex items-center gap-2 mb-2">
                      <Leaf className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Your fresh version
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 mb-2">0 additives</p>
                    <p className="text-sm text-gray-600">
                      Just whole-food ingredients you can pronounce.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Savings Banner */}
            {typeof recipe?.estimatedCostPerServing === 'number' &&
              typeof recipe?.storeBoughtCost === 'number' &&
              recipe.storeBoughtCost > recipe.estimatedCostPerServing && (
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 rounded-lg">
                  <PiggyBank className="h-8 w-8 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700">
                      You saved ~${(recipe.storeBoughtCost - recipe.estimatedCostPerServing).toFixed(2)} per serving!
                    </p>
                    <p className="text-sm text-gray-600">
                      Homemade ~${recipe.estimatedCostPerServing.toFixed(2)}/serving vs. store-bought ~$
                      {recipe.storeBoughtCost.toFixed(2)}/serving
                    </p>
                  </div>
                </div>
              )}

            {/* Recipe Meta Info */}
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Prep: {recipe?.prepTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Cook: {recipe?.cookTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Servings: {recipe?.servings}</span>
              </div>
            </div>

            {/* Dietary Tags */}
            {appliedDietaryTags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {appliedDietaryTags?.map?.((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">Fresh Ingredients</h3>
                {isRegeneratingWithSubstitute && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Regenerating with {substitutionInfo?.substitute}...</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Tap any ingredient for info, substitutes, shopping list, or to remove it
              </p>
              <ul className="space-y-1">
                {recipe?.freshIngredients?.map?.((ingredient, index) => (
                  <li key={index}>
                    <InteractiveIngredient
                      ingredient={ingredient}
                      index={index}
                      onDelete={handleDeleteIngredient}
                      onSubstitute={handleSubstituteIngredient}
                      showDelete={true}
                      isRegenerating={isRegeneratingWithSubstitute}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h3>
              <ol className="space-y-3">
                {recipe?.instructions?.map?.((instruction, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 pt-0.5">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Dietary Customization Buttons */}
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customize This Recipe</h3>
              
              {/* Preset Dietary Options */}
              <div className="flex flex-wrap gap-3 mb-4">
                {dietaryButtons?.map?.((button) => (
                  <Button
                    key={button?.value}
                    onClick={() => generateRecipe(button?.value)}
                    variant="outline"
                    disabled={isGenerating}
                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                  >
                    {button?.label}
                  </Button>
                ))}
              </div>

              {/* Custom Customization Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Or type your own customization:
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Make it spicier, Add more protein, Use less salt..."
                    value={customCustomization}
                    onChange={(e) => setCustomCustomization(e.target.value)}
                    disabled={isGenerating}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customCustomization.trim()) {
                        generateRecipe(customCustomization);
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (customCustomization.trim()) {
                        generateRecipe(customCustomization);
                        setCustomCustomization('');
                      }
                    }}
                    disabled={isGenerating || !customCustomization.trim()}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Customizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Apply
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Describe any changes you&apos;d like to make to this recipe
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Recipe Prompt Dialog */}
      <AlertDialog open={showSavePrompt} onOpenChange={setShowSavePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-emerald-600" />
              Save Your Recipe?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to save &quot;{recipe?.title}&quot; to your recipe collection? You can access it anytime from your Recipes page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Save Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveRecipe}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
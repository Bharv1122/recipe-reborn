"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import IngredientImageUpload from "@/components/IngredientImageUpload";

interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookTime: string;
  servings: number;
  nutritionInfo: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  tags: string[];
}

export default function RecipeGenerator() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          setIsAuthenticated(false);
          return;
        }

        const data = await response.json();
        setIsAuthenticated(Boolean(data?.authenticated));
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveMessage(null);
    
    // Simulate AI generation (in production, this would call your AI API)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Build tags from selections
    const tags: string[] = [];
    if (dietaryPreference) tags.push(dietaryPreference);
    if (cuisineType) tags.push(cuisineType);
    
    // Mock recipe response
    const mockRecipe: Recipe = {
      title: `Healthy ${cuisineType || 'Fusion'} ${dietaryPreference || ''} Bowl`.trim(),
      description: `A delicious and nutritious dish made with ${ingredients.split(',')[0]?.trim() || 'fresh ingredients'} and more.`,
      ingredients: ingredients.split(',').map(i => i.trim()).filter(Boolean).concat(["Salt to taste", "Olive oil", "Fresh herbs"]),
      instructions: [
        "Wash and prepare all ingredients.",
        "Heat olive oil in a large pan over medium heat.",
        "Add the main ingredients and cook for 5-7 minutes.",
        "Season with salt and your preferred spices.",
        "Garnish with fresh herbs and serve hot."
      ],
      cookTime: "25 minutes",
      servings: 4,
      nutritionInfo: {
        calories: "320 kcal",
        protein: "18g",
        carbs: "35g",
        fat: "12g"
      },
      tags
    };
    
    setRecipe(mockRecipe);
    setLoading(false);
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch("/api/recipes/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recipe),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Recipe saved successfully!' });
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save recipe' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
        </div>
        <Footer />
      </main>
    );
  }

  // Require authentication
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h1>
            <p className="text-gray-600 mb-6">Please sign in to use the AI Recipe Generator.</p>
            <Link href="/login">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                Sign In
              </button>
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 text-center">
            AI Recipe Generator
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upload a photo of an ingredient label — or type ingredients — and we&apos;ll transform it into a fresh, healthy recipe.
          </p>

          {/* Input Form */}
          <form onSubmit={handleGenerate} className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="space-y-6">
              {/* Image Upload (OCR) */}
              <IngredientImageUpload
                onIngredientsExtracted={(text) => setIngredients(text)}
              />

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs font-medium text-gray-400 uppercase">
                  or type ingredients
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ingredients (comma-separated)
                </label>
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="e.g., chicken breast, broccoli, rice, garlic"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dietary Preference
                  </label>
                  <select
                    value={dietaryPreference}
                    onChange={(e) => setDietaryPreference(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Any</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Keto">Keto</option>
                    <option value="Gluten-Free">Gluten-Free</option>
                    <option value="Low-Carb">Low-Carb</option>
                    <option value="High-Protein">High-Protein</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuisine Type
                  </label>
                  <select
                    value={cuisineType}
                    onChange={(e) => setCuisineType(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Any</option>
                    <option value="Italian">Italian</option>
                    <option value="Mexican">Mexican</option>
                    <option value="Asian">Asian</option>
                    <option value="Mediterranean">Mediterranean</option>
                    <option value="Indian">Indian</option>
                    <option value="American">American</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !ingredients.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating Recipe...
                  </span>
                ) : (
                  "Generate Recipe"
                )}
              </button>
            </div>
          </form>

          {/* Generated Recipe */}
          {recipe && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{recipe.title}</h2>
                  <p className="text-gray-600 mt-1">{recipe.description}</p>
                </div>
                <button
                  onClick={handleSaveRecipe}
                  disabled={saving}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                  Save
                </button>
              </div>
              
              {/* Save Message */}
              {saveMessage && (
                <div className={`mb-4 p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {saveMessage.text}
                  {saveMessage.type === 'success' && (
                    <Link href="/my-recipes" className="ml-2 underline">
                      View My Recipes
                    </Link>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <span className="bg-gray-100 px-3 py-1 rounded-full">⏱️ {recipe.cookTime}</span>
                <span className="bg-gray-100 px-3 py-1 rounded-full">👥 {recipe.servings} servings</span>
                {recipe.tags.map(tag => (
                  <span key={tag} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>

              {/* Health Improvement Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-900">Your Fresh Upgrade</h4>
                    <p className="text-sm text-emerald-800 mt-0.5">
                      This recipe replaces processed ingredients with whole foods — no artificial colors, preservatives, or added sugars. 💚
                    </p>
                  </div>
                </div>
              </div>

              {/* Nutrition Info */}
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Nutrition per serving
              </h3>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-semibold text-emerald-700">{recipe.nutritionInfo.calories}</p>
                  <p className="text-xs text-gray-600">Calories</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-semibold text-emerald-700">{recipe.nutritionInfo.protein}</p>
                  <p className="text-xs text-gray-600">Protein</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-semibold text-emerald-700">{recipe.nutritionInfo.carbs}</p>
                  <p className="text-xs text-gray-600">Carbs</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-semibold text-emerald-700">{recipe.nutritionInfo.fat}</p>
                  <p className="text-xs text-gray-600">Fat</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Ingredients */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Ingredients</h3>
                  <ul className="space-y-2">
                    {recipe.ingredients.map((ingredient, index) => (
                      <li key={index} className="flex items-center gap-2 text-gray-700">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h3>
                  <ol className="space-y-3">
                    {recipe.instructions.map((instruction, index) => (
                      <li key={index} className="flex gap-3 text-gray-700">
                        <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

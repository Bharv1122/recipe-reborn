"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
}

export default function RecipeGenerator() {
  const [ingredients, setIngredients] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate AI generation (in production, this would call your AI API)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
      }
    };
    
    setRecipe(mockRecipe);
    setLoading(false);
  };

  const handleSaveRecipe = () => {
    // In production, this would save to the user's account
    alert("Recipe saved to your collection!");
  };

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 text-center">
            AI Recipe Generator
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Enter your ingredients and preferences to generate a healthy recipe
          </p>

          {/* Input Form */}
          <form onSubmit={handleGenerate} className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="space-y-6">
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
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save
                </button>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <span className="bg-gray-100 px-3 py-1 rounded-full">⏱️ {recipe.cookTime}</span>
                <span className="bg-gray-100 px-3 py-1 rounded-full">👥 {recipe.servings} servings</span>
              </div>

              {/* Nutrition Info */}
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

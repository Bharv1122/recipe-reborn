"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

interface Recipe {
  id: string;
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
  createdAt: string;
}

export default function RecipeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await fetch(`/api/recipes/${id}`);
        const data = await response.json();
        
        if (response.ok) {
          setRecipe(data.recipe);
        } else {
          setError(data.error || "Failed to load recipe");
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this recipe?")) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        router.push("/my-recipes");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete recipe");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete recipe");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/my-recipes">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                Back to My Recipes
              </button>
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Recipe Not Found</h1>
            <Link href="/my-recipes">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                Back to My Recipes
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
          {/* Back Button */}
          <Link href="/my-recipes" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Recipes
          </Link>

          <div className="bg-white rounded-xl shadow-md p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{recipe.title}</h1>
                <p className="text-gray-600">{recipe.description}</p>
                <p className="text-sm text-gray-400 mt-2">Created on {formatDate(recipe.createdAt)}</p>
              </div>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-red-100 hover:bg-red-200 text-red-600 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {deleteLoading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                Delete
              </button>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <span className="bg-gray-100 px-3 py-1 rounded-full">⏱️ {recipe.cookTime}</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">👥 {recipe.servings} servings</span>
              {recipe.tags.map(tag => (
                <span key={tag} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>

            {/* Nutrition Info */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xl font-semibold text-emerald-700">{recipe.nutritionInfo.calories}</p>
                <p className="text-sm text-gray-600">Calories</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xl font-semibold text-emerald-700">{recipe.nutritionInfo.protein}</p>
                <p className="text-sm text-gray-600">Protein</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xl font-semibold text-emerald-700">{recipe.nutritionInfo.carbs}</p>
                <p className="text-sm text-gray-600">Carbs</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xl font-semibold text-emerald-700">{recipe.nutritionInfo.fat}</p>
                <p className="text-sm text-gray-600">Fat</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Ingredients */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h2>
                <ul className="space-y-3">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="flex items-center gap-3 text-gray-700">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></span>
                      {ingredient}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instructions */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
                <ol className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3 text-gray-700">
                      <span className="flex-shrink-0 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

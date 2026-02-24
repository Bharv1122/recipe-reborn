"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SavedRecipe {
  id: string;
  title: string;
  description: string;
  cookTime: string;
  createdAt: string;
  tags: string[];
}

export default function MyRecipes() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndLoadRecipes = async () => {
      try {
        const authResponse = await fetch("/api/auth/me");
        if (authResponse.ok) {
          setIsAuthenticated(true);
          
          // Fetch user's recipes from API
          const recipesResponse = await fetch("/api/recipes");
          if (recipesResponse.ok) {
            const data = await recipesResponse.json();
            setRecipes(data.recipes || []);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Failed to load recipes:", error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndLoadRecipes();
  }, []);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || (recipe.tags || []).includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recipe?")) return;
    
    setDeleteLoading(id);
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setRecipes(recipes.filter(r => r.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete recipe");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete recipe");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleView = (id: string) => {
    router.push(`/recipe/${id}`);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h1>
            <p className="text-gray-600 mb-6">You need to be logged in to view your saved recipes.</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                My Recipes
              </h1>
              <p className="text-gray-600">
                {recipes.length} saved recipe{recipes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/recipe-generator" className="mt-4 md:mt-0">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate New Recipe
              </button>
            </Link>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="md:w-48">
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Recipe Grid */}
          {filteredRecipes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map((recipe) => (
                <div key={recipe.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{recipe.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{recipe.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(recipe.tags || []).map(tag => (
                        <span key={tag} className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span>⏱️ {recipe.cookTime}</span>
                      <span>{formatDate(recipe.createdAt)}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(recipe.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        disabled={deleteLoading === recipe.id}
                        className="bg-red-100 hover:bg-red-200 text-red-600 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleteLoading === recipe.id ? (
                          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {recipes.length === 0 ? "No recipes saved yet" : "No recipes found matching your search"}
              </p>
              <Link href="/recipe-generator">
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                  Generate Your First Recipe
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

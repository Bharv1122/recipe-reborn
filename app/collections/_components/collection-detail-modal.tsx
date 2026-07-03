'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Trash2,
  FileDown,
  Clock,
  Users,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Recipe {
  id: string;
  title: string;
  dietaryTags: string[];
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  rating?: number | null;
}

interface CollectionRecipe {
  id: string;
  order: number;
  recipe: Recipe;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  collectionRecipes: CollectionRecipe[];
}

interface CollectionDetailModalProps {
  collectionId: string;
  onClose: () => void;
}

export function CollectionDetailModal({
  collectionId,
  onClose,
}: CollectionDetailModalProps) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchCollection();
    fetchAvailableRecipes();
  }, [collectionId]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        toast.error('Failed to load collection');
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      toast.error('Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      if (response.ok) {
        const data = await response.json();
        setAvailableRecipes(data);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipeId) {
      toast.error('Please select a recipe');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`/api/collections/${collectionId}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: selectedRecipeId }),
      });

      if (response.ok) {
        await fetchCollection();
        setSelectedRecipeId('');
        toast.success('Recipe added to collection');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add recipe');
      }
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast.error('Failed to add recipe');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    setRemovingId(recipeId);
    try {
      const response = await fetch(
        `/api/collections/${collectionId}/recipes/${recipeId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchCollection();
        toast.success('Recipe removed from collection');
      } else {
        toast.error('Failed to remove recipe');
      }
    } catch (error) {
      console.error('Error removing recipe:', error);
      toast.error('Failed to remove recipe');
    } finally {
      setRemovingId(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/collections/${collectionId}/export`, {
        method: 'POST',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collection?.name || 'collection'}-cookbook.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Cookbook exported successfully!');
      } else {
        toast.error('Failed to export cookbook');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export cookbook');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!collection) {
    return null;
  }

  // Filter out recipes already in collection
  const recipesInCollection = new Set(
    collection.collectionRecipes.map((cr) => cr.recipe.id)
  );
  const filteredAvailableRecipes = availableRecipes.filter(
    (r) => !recipesInCollection.has(r.id)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{collection.name}</DialogTitle>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Recipe Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Recipe to Collection</label>
            <div className="flex gap-2">
              <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a recipe to add" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAvailableRecipes.length === 0 ? (
                    <SelectItem value="no-recipes" disabled>
                      No more recipes available
                    </SelectItem>
                  ) : (
                    filteredAvailableRecipes.map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleAddRecipe} disabled={adding || !selectedRecipeId}>
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExportPDF}
            disabled={exporting || collection.collectionRecipes.length === 0}
            className="w-full"
            variant="outline"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export as PDF Cookbook
          </Button>

          {/* Recipes List */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">
              Recipes ({collection.collectionRecipes.length})
            </h3>
            {collection.collectionRecipes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  No recipes in this collection yet. Add some recipes above!
                </CardContent>
              </Card>
            ) : (
              collection.collectionRecipes.map(({ recipe }) => (
                <Card key={recipe.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">{recipe.title}</h4>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {recipe.prepTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Prep: {recipe.prepTime}
                            </span>
                          )}
                          {recipe.cookTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Cook: {recipe.cookTime}
                            </span>
                          )}
                          {recipe.servings && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Serves: {recipe.servings}
                            </span>
                          )}
                          {recipe.rating && recipe.rating > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {recipe.rating}
                            </span>
                          )}
                        </div>
                        {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {recipe.dietaryTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-1 bg-secondary rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveRecipe(recipe.id)}
                        disabled={removingId === recipe.id}
                      >
                        {removingId === recipe.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

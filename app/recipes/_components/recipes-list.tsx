'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StarRating } from '@/components/ui/star-rating';
import { Loader2, Trash2, Clock, Users, ChefHat, Filter, Share2, FolderInput, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { RecipeDetailModal } from './recipe-detail-modal';
import { FolderSidebar } from './folder-sidebar';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  folderId?: string | null;
  isPublic?: boolean;
  shareToken?: string | null;
  createdAt: string;
}

interface Folder {
  id: string;
  name: string;
  color?: string;
  order: number;
  _count?: {
    recipes: number;
  };
}

export function RecipesList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchRecipes();
    fetchFolders();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      if (!response?.ok) {
        throw new Error('Failed to fetch recipes');
      }
      const data = await response.json();
      setRecipes(data?.recipes ?? []);
    } catch (error) {
      console.error('Fetch recipes error:', error);
      toast.error('Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      if (!response?.ok) {
        throw new Error('Failed to fetch folders');
      }
      const data = await response.json();
      setFolders(data ?? []);
    } catch (error) {
      console.error('Fetch folders error:', error);
      toast.error('Failed to load folders');
    }
  };

  const deleteRecipe = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'DELETE',
      });

      if (!response?.ok) {
        throw new Error('Failed to delete recipe');
      }

      setRecipes((prev) => prev?.filter?.((r) => r?.id !== id) ?? []);
      toast.success('Recipe deleted successfully');
      fetchFolders(); // Refresh folder counts
    } catch (error) {
      console.error('Delete recipe error:', error);
      toast.error('Failed to delete recipe');
    } finally {
      setDeletingId(null);
    }
  };

  const moveRecipeToFolder = async (recipeId: string, folderId: string | null) => {
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });

      if (!response?.ok) {
        throw new Error('Failed to move recipe');
      }

      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? { ...r, folderId } : r))
      );
      fetchFolders(); // Refresh folder counts
      toast.success(`Recipe moved ${folderId ? 'to folder' : 'to All Recipes'} successfully`);
    } catch (error) {
      console.error('Error moving recipe:', error);
      toast.error('Failed to move recipe');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const recipeId = active.id as string;
    const targetFolderId = over.id === 'all-recipes' ? null : (over.id as string);

    moveRecipeToFolder(recipeId, targetFolderId);
  };

  const toggleRecipeSharing = async (recipeId: string, currentlyPublic: boolean) => {
    try {
      const response = await fetch(`/api/recipes/share/${recipeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentlyPublic }),
      });

      if (!response?.ok) {
        throw new Error('Failed to update sharing');
      }

      const data = await response.json();
      
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? data.recipe : r))
      );

      if (data.shareUrl && !currentlyPublic) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Share link copied to clipboard!');
      } else {
        toast.success('Recipe made private');
      }
    } catch (error) {
      console.error('Error toggling sharing:', error);
      toast.error('Failed to update recipe sharing');
    }
  };

  // Get all unique dietary tags from recipes
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach(recipe => {
      recipe?.dietaryTags?.forEach?.(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [recipes]);

  // Filter and search recipes
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    // Filter by folder
    if (selectedFolderId) {
      filtered = filtered.filter(recipe => recipe.folderId === selectedFolderId);
    } else if (selectedFolderId === null) {
      // Show all recipes when "All Recipes" is selected
      filtered = recipes;
    }

    // Filter by dietary tag
    if (filterTag !== 'all') {
      filtered = filtered.filter(recipe => 
        recipe?.dietaryTags?.includes?.(filterTag)
      );
    }

    // Search by title or ingredients
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe?.title?.toLowerCase().includes(query) ||
        recipe?.freshIngredients?.toLowerCase().includes(query) ||
        recipe?.originalIngredients?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [recipes, filterTag, searchQuery, selectedFolderId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (recipes?.length === 0) {
    return (
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <Camera className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No recipes yet</h3>
          <p className="text-gray-600 mb-6">
            📸 Grab any box from your pantry and scan the label — we&apos;ll turn it into a fresh homemade version.
          </p>
          <Button
            onClick={() => (window.location.href = '/generator')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Camera className="mr-2 h-4 w-4" />
            Scan Your First Label
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Folder Sidebar — stacks on top on mobile, sidebar on lg+ */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <Card className="shadow-lg border-0 bg-white h-full">
            <FolderSidebar
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onFoldersChange={fetchFolders}
            />
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search and Filter Bar */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search recipes by title or ingredients..."
                />
              </div>
              <div>
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by dietary tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Recipes</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(searchQuery || filterTag !== 'all' || selectedFolderId) && (
              <p className="text-sm text-gray-600">
                Showing {filteredRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Recipes Grid */}
          {filteredRecipes.length === 0 ? (
            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="py-12 text-center">
                <ChefHat className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No recipes found matching your criteria</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRecipes?.map?.((recipe, index) => (
                <RecipeCard
                  key={recipe?.id}
                  recipe={recipe}
                  index={index}
                  folders={folders}
                  onDelete={deleteRecipe}
                  onSelect={setSelectedRecipe}
                  onMoveToFolder={moveRecipeToFolder}
                  onToggleSharing={toggleRecipeSharing}
                  isDeleting={deletingId === recipe?.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onUpdate={() => {
            fetchRecipes();
            fetchFolders();
          }}
        />
      )}
    </DndContext>
  );
}

// Recipe Card Component with Drag-and-Drop
function RecipeCard({
  recipe,
  index,
  folders,
  onDelete,
  onSelect,
  onMoveToFolder,
  onToggleSharing,
  isDeleting,
}: {
  recipe: Recipe;
  index: number;
  folders: Folder[];
  onDelete: (id: string) => void;
  onSelect: (recipe: Recipe) => void;
  onMoveToFolder: (recipeId: string, folderId: string | null) => void;
  onToggleSharing: (recipeId: string, isPublic: boolean) => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: recipe.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="shadow-lg border-0 bg-white hover:shadow-xl transition-all-smooth hover-lift cursor-pointer animate-fadeIn relative"
      {...attributes}
    >
      {/* Drag Handle */}
      <div
        {...listeners}
        className="absolute top-2 right-2 p-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-lg transition-colors z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>

      <div onClick={() => onSelect(recipe)}>
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 pr-12">
          <CardTitle className="text-xl text-gray-900 line-clamp-2">
            {recipe?.title}
          </CardTitle>
          {recipe?.isPublic && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <Share2 className="h-3 w-3" />
              <span>Public</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Rating */}
          {(recipe?.rating ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <StarRating value={recipe?.rating ?? 0} readonly size="sm" />
              <span className="text-sm text-gray-600">({recipe?.rating}/5)</span>
            </div>
          )}

          {/* Dietary Tags */}
          {recipe?.dietaryTags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe?.dietaryTags?.slice?.(0, 3)?.map?.((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
              {(recipe?.dietaryTags?.length ?? 0) > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  +{(recipe?.dietaryTags?.length ?? 0) - 3} more
                </span>
              )}
            </div>
          )}

          {/* Recipe Meta Info */}
          <div className="space-y-2 text-sm text-gray-600">
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

          {/* Date */}
          <p className="text-xs text-gray-500">
            Saved on {new Date(recipe?.createdAt)?.toLocaleDateString?.()}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  Move
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onMoveToFolder(recipe.id, null)}>
                  All Recipes
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => onMoveToFolder(recipe.id, folder.id)}>
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSharing(recipe.id, recipe.isPublic ?? false);
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {recipe.isPublic ? 'Unshare' : 'Share'}
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(recipe?.id);
              }}
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
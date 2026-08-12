'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Package, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatItemsForInstacart } from '@/lib/instacart-list';

interface ShoppingListItem {
  id: string;
  ingredient: string;
  quantity?: string;
  unit?: string;
  category?: string;
  checked: boolean;
  recipeTitle?: string;
}

interface ShoppingList {
  id: string;
  name: string;
  notes: string | null;
  items: ShoppingListItem[];
}

interface ShoppingListViewProps {
  list: ShoppingList;
  onUpdate: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Produce': '🥬',
  'Dairy': '🥛',
  'Meat & Seafood': '🍖',
  'Pantry': '🥫',
  'Other': '📦',
};

export function ShoppingListView({ list, onUpdate }: ShoppingListViewProps) {
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  // Group items by category
  const itemsByCategory = list.items.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  const categories = Object.keys(itemsByCategory).sort();
  const checkedCount = list.items.filter((item) => item.checked).length;
  const progress = list.items.length > 0 ? Math.round((checkedCount / list.items.length) * 100) : 0;
  const instacartText = formatItemsForInstacart(list.items);

  const handleCopyForInstacart = async () => {
    if (!instacartText) return;

    try {
      await navigator.clipboard.writeText(instacartText);
      toast.success('List copied. In Instacart Shopping List, tap Paste items.');
    } catch (error) {
      console.error('Error copying shopping list:', error);
      toast.error('Could not copy the list. Please copy the items manually.');
    }
  };

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    try {
      const response = await fetch(`/api/shopping-lists/${list.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked }),
      });

      if (response.ok) {
        onUpdate();
      } else {
        toast.error('Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/shopping-lists/${list.id}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate();
        toast.success('Item removed');
      } else {
        toast.error('Failed to remove item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to remove item');
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    try {
      setAdding(true);
      const response = await fetch(`/api/shopping-lists/${list.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient: newItemName,
          category: 'Other',
        }),
      });

      if (response.ok) {
        setNewItemName('');
        onUpdate();
        toast.success('Item added');
      } else {
        toast.error('Failed to add item');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-2xl">{list.name}</CardTitle>
            {list.notes && (
              <p className="text-sm text-muted-foreground mt-1">{list.notes}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{progress}%</div>
            <div className="text-xs text-muted-foreground">
              {checkedCount} of {list.items.length}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {list.items.length > 0 && (
          <section aria-labelledby="instacart-handoff-title" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 id="instacart-handoff-title" className="font-semibold text-emerald-950">
              Continue in your Instacart app
            </h3>
            <p className="mt-1 text-sm text-emerald-900">
              Copy the unchecked items, open Instacart, then go to Shopping List and tap <strong>Paste items</strong>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={handleCopyForInstacart}
                disabled={!instacartText}
                className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy for Instacart
              </Button>
              <Button asChild type="button" variant="outline" className="min-h-11 border-emerald-700 text-emerald-900">
                <a href="https://www.instacart.com/store" target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  Open Instacart
                </a>
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-800">
              Recipe Reborn copies text only. You choose products, retailer, checkout, and delivery in Instacart. Alcohol availability varies; purchasers must be 21+ and show valid ID.
            </p>
          </section>
        )}

        {/* Add New Item */}
        <div className="flex gap-2">
          <Input
            placeholder="Add new item..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            disabled={adding}
          />
          <Button
            onClick={handleAddItem}
            disabled={!newItemName.trim() || adding}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Items by Category */}
        {list.items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No items in this list yet</p>
            <p className="text-sm mt-1">Add items manually or generate from meal plans</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => {
              const items = itemsByCategory[category];
              const categoryIcon = CATEGORY_ICONS[category] || CATEGORY_ICONS['Other'];

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <span className="text-lg">{categoryIcon}</span>
                    <h3 className="font-semibold text-sm uppercase tracking-wide">
                      {category}
                    </h3>
                    <Badge variant="secondary" className="ml-auto">
                      {items.length}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          item.checked
                            ? 'bg-secondary/50 opacity-60'
                            : 'bg-background hover:bg-secondary/30'
                        }`}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={(checked) =>
                            handleToggleItem(item.id, checked as boolean)
                          }
                        />

                        <div className="flex-1">
                          <div className={`font-medium ${item.checked ? 'line-through' : ''}`}>
                            {item.quantity && item.unit
                              ? `${item.quantity} ${item.unit} `
                              : item.quantity
                              ? `${item.quantity} `
                              : ''}
                            {item.ingredient}
                          </div>
                          {item.recipeTitle && (
                            <div className="text-xs text-muted-foreground mt-1">
                              From: {item.recipeTitle}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

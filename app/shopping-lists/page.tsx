'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShoppingListCard } from './_components/shopping-list-card';
import { ShoppingListView } from './_components/shopping-list-view';
import { CreateListDialog } from './_components/create-list-dialog';

interface ShoppingList {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  items: any[];
}

export default function ShoppingListsPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchLists();
    }
  }, [status, router]);

  useEffect(() => {
    // Select list from URL parameter if provided
    const listId = searchParams?.get('id');
    if (listId && lists.length > 0) {
      const list = lists.find((l) => l.id === listId);
      if (list) {
        setSelectedList(list);
      }
    }
  }, [searchParams, lists]);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shopping-lists');
      if (response.ok) {
        const data = await response.json();
        setLists(data);
        if (data.length > 0 && !selectedList) {
          setSelectedList(data[0]);
        }
      } else {
        toast.error('Failed to load shopping lists');
      }
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      toast.error('Failed to load shopping lists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = () => {
    setCreateDialogOpen(true);
  };

  const handleListCreated = (newList: ShoppingList) => {
    setLists([newList, ...lists]);
    setSelectedList(newList);
    setCreateDialogOpen(false);
    toast.success('Shopping list created!');
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const response = await fetch(`/api/shopping-lists/${listId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLists(lists.filter((l) => l.id !== listId));
        if (selectedList?.id === listId) {
          setSelectedList(lists[0] || null);
        }
        toast.success('Shopping list deleted');
      } else {
        toast.error('Failed to delete shopping list');
      }
    } catch (error) {
      console.error('Error deleting shopping list:', error);
      toast.error('Failed to delete shopping list');
    }
  };

  const handleListUpdate = () => {
    fetchLists();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">Shopping Lists</h1>
            <p className="text-emerald-50/90 mt-2">
              Organize your grocery shopping and check off items
            </p>
          </div>
          <Button onClick={handleCreateList} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            New List
          </Button>
        </div>

        {lists.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Shopping Lists Yet</CardTitle>
              <CardDescription>
                Create your first shopping list or generate one from your meal plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button onClick={handleCreateList} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Create New List
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push('/meal-planner')}
                >
                  Go to Meal Planner
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Lists */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Your Lists
              </h3>
              {lists.map((list) => (
                <ShoppingListCard
                  key={list.id}
                  list={list}
                  isSelected={selectedList?.id === list.id}
                  onClick={() => setSelectedList(list)}
                  onDelete={() => handleDeleteList(list.id)}
                />
              ))}
            </div>

            {/* Main Content - List Items */}
            <div className="lg:col-span-3">
              {selectedList && (
                <ShoppingListView
                  list={selectedList}
                  onUpdate={handleListUpdate}
                />
              )}
            </div>
          </div>
        )}

        {/* Create Dialog */}
        <CreateListDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onListCreated={handleListCreated}
        />
      </div>
    </div>
  );
}

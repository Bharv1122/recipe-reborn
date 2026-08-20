'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, CheckCircle2, ImagePlus, Loader2, Plus, Refrigerator, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  pantryItemsToText,
  type PantryInventoryItem,
} from '@/lib/pantry-inventory';

type Location = 'fridge' | 'pantry';
type DraftItem = PantryInventoryItem & { confidence?: 'high' | 'medium' | 'low' };
type PhotoSlot = { file: File; preview: string };

interface PantryPhotoInventoryProps {
  disabled?: boolean;
  onUseInventory: (inventoryText: string) => void;
}

async function compressPhoto(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024 || !file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export function PantryPhotoInventory({ disabled = false, onUseInventory }: PantryPhotoInventoryProps) {
  const [photos, setPhotos] = useState<Partial<Record<Location, PhotoSlot>>>({});
  const [savedItems, setSavedItems] = useState<PantryInventoryItem[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const previewUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pantry-inventory')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && Array.isArray(data?.inventory?.items)) setSavedItems(data.inventory.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewUrlsRef.current.clear();
  }, []);

  const choosePhoto = async (location: Location, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    const prepared = await compressPhoto(file);
    if (prepared.size > 3 * 1024 * 1024) {
      toast.error('That photo is still too large. Crop it or choose a smaller image.');
      return;
    }
    const preview = URL.createObjectURL(prepared);
    previewUrlsRef.current.add(preview);
    setPhotos((current) => {
      const previous = current[location];
      if (previous) {
        URL.revokeObjectURL(previous.preview);
        previewUrlsRef.current.delete(previous.preview);
      }
      return { ...current, [location]: { file: prepared, preview } };
    });
    setDraftItems([]);
    setReviewConfirmed(false);
  };

  const removePhoto = (location: Location) => {
    setPhotos((current) => {
      const next = { ...current };
      const previous = next[location];
      if (previous) {
        URL.revokeObjectURL(previous.preview);
        previewUrlsRef.current.delete(previous.preview);
      }
      delete next[location];
      return next;
    });
    setDraftItems([]);
    setReviewConfirmed(false);
  };

  const extractInventory = async () => {
    const selected = (['fridge', 'pantry'] as const)
      .map((location) => ({ location, photo: photos[location] }))
      .filter((entry): entry is { location: Location; photo: PhotoSlot } => Boolean(entry.photo));
    if (selected.length === 0) return;

    setIsExtracting(true);
    setReviewConfirmed(false);
    try {
      const form = new FormData();
      selected.forEach(({ location, photo }) => {
        form.append('images', photo.file);
        form.append('locations', location);
      });
      const response = await fetch('/api/pantry-inventory/extract', { method: 'POST', body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not analyze those photos.');
      setDraftItems(data.items);
      setReviewNotes(Array.isArray(data.reviewNotes) ? data.reviewNotes : []);
      toast.success(`Found ${data.items.length} possible items. Please review every one.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not analyze those photos.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setDraftItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    setReviewConfirmed(false);
  };

  const removeItem = (index: number) => {
    setDraftItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
    setReviewConfirmed(false);
  };

  const addItem = () => {
    setDraftItems((items) => [...items, { name: '', quantity: null, location: 'unknown', confidence: 'high' }]);
    setReviewConfirmed(false);
  };

  const saveInventory = async () => {
    const cleaned = draftItems.filter((item) => item.name.trim());
    if (!reviewConfirmed || cleaned.length === 0) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/pantry-inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewConfirmed: true,
          items: cleaned.map(({ name, quantity, location }) => ({ name, quantity, location })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not save the inventory.');
      const confirmed = data.inventory.items as PantryInventoryItem[];
      setSavedItems(confirmed);
      onUseInventory(pantryItemsToText(confirmed));
      toast.success('Reviewed inventory saved and ready for recipe ideas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the inventory.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-labelledby="photo-inventory-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="photo-inventory-title" className="flex items-center gap-2 font-semibold text-emerald-950">
            <Camera className="h-4 w-4" aria-hidden="true" /> Photograph your fridge or pantry
          </h3>
          <p className="mt-1 text-sm text-emerald-900">
            Add either photo or both. Photos are analyzed, not saved. You must correct and confirm the list before it is stored.
          </p>
        </div>
        {!isLoadingSaved && savedItems.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onUseInventory(pantryItemsToText(savedItems))}
            disabled={disabled}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Use saved list ({savedItems.length})
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['fridge', 'pantry'] as const).map((location) => {
          const photo = photos[location];
          const label = location === 'fridge' ? 'Refrigerator photo' : 'Pantry photo';
          return (
            <div key={location} className="rounded-lg border border-emerald-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {location === 'fridge' ? <Refrigerator className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                  {label}
                </p>
                {photo && (
                  <button type="button" onClick={() => removePhoto(location)} className="text-sm text-red-700 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              {photo && (
                <Image
                  src={photo.preview}
                  alt={`${label} preview`}
                  width={640}
                  height={320}
                  unoptimized
                  className="mt-2 h-32 w-full rounded-md object-cover"
                />
              )}
              <label className="mt-3 block cursor-pointer rounded-md border border-dashed border-emerald-400 px-3 py-2 text-center text-sm font-medium text-emerald-800 hover:bg-emerald-50">
                {photo ? 'Replace photo' : 'Choose or take photo'}
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="sr-only"
                  disabled={disabled || isExtracting}
                  onChange={(event) => {
                    void choosePhoto(location, event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={extractInventory}
        disabled={disabled || isExtracting || Object.keys(photos).length === 0}
        className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
      >
        {isExtracting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading visible contents…</> : 'Build a draft inventory from photos'}
      </Button>

      {draftItems.length > 0 && (
        <div className="space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <div>
            <h4 className="font-semibold text-amber-950">Review and correct this draft</h4>
            <p className="text-sm text-amber-900">AI can miss hidden items or misread containers. Fix names, quantities, and locations; remove anything that is not actually there.</p>
          </div>
          {reviewNotes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
              {reviewNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <div className="space-y-2">
            {draftItems.map((item, index) => (
              <div
                key={index}
                className={`grid gap-2 rounded-md bg-white p-2 sm:grid-cols-[1fr_8rem_8rem_auto] ${item.confidence === 'low' ? 'border-2 border-orange-400' : 'border border-amber-200'}`}
                title={item.confidence === 'low' ? 'Low-confidence detection — check this item carefully' : undefined}
              >
                <Input aria-label={`Item ${index + 1} name`} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Item name" />
                <Input aria-label={`${item.name || `Item ${index + 1}`} quantity`} value={item.quantity ?? ''} onChange={(event) => updateItem(index, { quantity: event.target.value || null })} placeholder="Quantity" />
                <select aria-label={`${item.name || `Item ${index + 1}`} location`} value={item.location} onChange={(event) => updateItem(index, { location: event.target.value as PantryInventoryItem['location'] })} className="min-h-10 rounded-md border border-input bg-white px-3 text-sm">
                  <option value="fridge">Fridge</option>
                  <option value="pantry">Pantry</option>
                  <option value="unknown">Unsure</option>
                </select>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} aria-label={`Remove ${item.name || `item ${index + 1}`}`}>
                  <Trash2 className="h-4 w-4 text-red-700" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add missed item</Button>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-white p-3 text-sm text-gray-900">
            <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
            <span>I reviewed this list and corrected or removed anything inaccurate.</span>
          </label>
          <Button type="button" onClick={saveInventory} disabled={disabled || isSaving || !reviewConfirmed || !draftItems.some((item) => item.name.trim())} className="w-full bg-emerald-700 text-white hover:bg-emerald-800">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving reviewed list…</> : <><Save className="mr-2 h-4 w-4" /> Save and use confirmed inventory</>}
          </Button>
        </div>
      )}
    </section>
  );
}

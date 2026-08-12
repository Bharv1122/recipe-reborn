'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic, MicOff, PackageCheck, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { comparePantryToRecipe } from '@/lib/pantry-match';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

interface PantryCheckDialogProps {
  recipeId: string;
  recipeTitle: string;
  ingredients: string[];
}

export function PantryCheckDialog({ recipeId, recipeTitle, ingredients }: PantryCheckDialogProps) {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [pantryText, setPantryText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const comparison = useMemo(
    () => comparePantryToRecipe(ingredients, pantryText),
    [ingredients, pantryText],
  );

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startListening = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    setVoiceError(null);
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalTranscript += result[0]?.transcript ?? '';
      }
      const spokenItems = finalTranscript.trim();
      if (spokenItems) {
        setPantryText((current) => current.trim()
          ? `${current.trim()}, ${spokenItems}`
          : spokenItems);
      }
    };
    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone permission was not granted. You can type pantry items instead.'
        : 'Voice entry stopped. You can try again or type pantry items.';
      setVoiceError(message);
      setIsListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError('Voice entry could not start. You can type pantry items instead.');
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  const handleCreateList = async () => {
    if (!pantryText.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/shopping-lists/from-recipe-pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, pantryItems: pantryText }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create shopping list');
      }

      if (!data?.shoppingList?.id) {
        toast.success(data?.message || 'You already have every ingredient for this recipe.');
        return;
      }

      toast.success(`Added ${data.missing.length} missing ingredient${data.missing.length === 1 ? '' : 's'} to a shopping list.`);
      setOpen(false);
      router.push(`/shopping-lists?id=${encodeURIComponent(data.shoppingList.id)}`);
    } catch (error) {
      console.error('Pantry check error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create shopping list');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) stopListening();
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
        >
          <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Check my pantry
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Check your pantry for {recipeTitle}</DialogTitle>
          <DialogDescription>
            Type or speak what you already have. Review the comparison, then create a list containing only the missing ingredients.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pantry-items" className="text-sm font-medium text-gray-900">
              Ingredients already on hand
            </label>
            <Textarea
              id="pantry-items"
              value={pantryText}
              onChange={(event) => setPantryText(event.target.value)}
              placeholder="For example: pasta, mushrooms, garlic, olive oil, salt"
              rows={4}
              disabled={isSubmitting}
            />
            {voiceSupported ? (
              <Button
                type="button"
                variant="outline"
                onClick={isListening ? stopListening : startListening}
                disabled={isSubmitting}
                aria-pressed={isListening}
              >
                {isListening ? (
                  <><MicOff className="mr-2 h-4 w-4" /> Stop listening</>
                ) : (
                  <><Mic className="mr-2 h-4 w-4" /> Speak pantry items</>
                )}
              </Button>
            ) : (
              <p className="text-xs text-gray-600">Voice entry is unavailable in this browser. You can type pantry items instead.</p>
            )}
            {isListening && (
              <p role="status" className="text-sm font-medium text-emerald-700">Listening… name the ingredients you already have.</p>
            )}
            {voiceError && <p role="alert" className="text-sm text-red-700">{voiceError}</p>}
          </div>

          {pantryText.trim() && (
            <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <h3 className="font-semibold text-emerald-950">Already on hand ({comparison.matched.length})</h3>
                {comparison.matched.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                    {comparison.matched.map((item) => <li key={item.ingredient}>✓ {item.ingredient}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-emerald-900">No recipe ingredients matched yet.</p>
                )}
              </section>
              <section className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <h3 className="font-semibold text-orange-950">Still needed ({comparison.missing.length})</h3>
                {comparison.missing.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-orange-950">
                    {comparison.missing.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-orange-950">You already have everything for this recipe.</p>
                )}
              </section>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateList}
            disabled={isSubmitting || !pantryText.trim() || comparison.missing.length === 0}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating list…</>
            ) : (
              <><ShoppingCart className="mr-2 h-4 w-4" /> Add missing items</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

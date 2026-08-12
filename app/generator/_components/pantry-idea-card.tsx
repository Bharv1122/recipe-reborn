'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, ShoppingBasket, Sparkles, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface PantryRecommendation {
  makeNow: { title: string; summary: string };
  upgrade: { title: string; addIngredient: string; summary: string };
}

interface PantryIdeaCardProps {
  ingredients: string;
  onChoose: (title: string, extraIngredient?: string) => void;
  disabled?: boolean;
}

export function PantryIdeaCard({ ingredients, onChoose, disabled = false }: PantryIdeaCardProps) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [recommendation, setRecommendation] = useState<PantryRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [canSpeak] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  useEffect(() => () => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const buildSpokenSummary = (result: PantryRecommendation) =>
    `Given what you have on hand, you can make ${result.makeNow.title}. If you pick up ${result.upgrade.addIngredient}, you could make ${result.upgrade.title}.`;

  const speak = (result: PantryRecommendation) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildSpokenSummary(result));
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const getIdeas = async () => {
    if (!ingredients.trim()) return;
    setIsLoading(true);
    stopSpeaking();
    try {
      const response = await fetch('/api/pantry-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Failed to create pantry ideas');
      setRecommendation(data);
      speak(data);
    } catch (error) {
      console.error('Pantry idea error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create pantry ideas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section aria-labelledby="pantry-ideas-title" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="pantry-ideas-title" className="flex items-center gap-2 font-semibold text-emerald-950">
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> Pantry ideas
          </h3>
          <p className="mt-1 text-sm text-emerald-900">
            Hear what you can cook now—and what one extra ingredient could unlock.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={getIdeas} disabled={disabled || isLoading || !ingredients.trim()}>
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" /> Suggest two ideas</>
          )}
        </Button>
      </div>

      {recommendation && (
        <div className="space-y-3" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cook with what you have</p>
              <h4 className="mt-1 font-semibold text-gray-950">{recommendation.makeNow.title}</h4>
              <p className="mt-1 text-sm text-gray-700">{recommendation.makeNow.summary}</p>
              <Button
                type="button"
                className="mt-3 w-full bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => onChoose(recommendation.makeNow.title)}
                disabled={disabled}
              >
                Make this now
              </Button>
            </article>
            <article className="rounded-lg border border-orange-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Get one more ingredient</p>
              <h4 className="mt-1 font-semibold text-gray-950">{recommendation.upgrade.title}</h4>
              <p className="mt-1 text-sm text-gray-700">{recommendation.upgrade.summary}</p>
              <p className="mt-2 text-sm font-semibold text-orange-900">Add: {recommendation.upgrade.addIngredient}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-orange-300 text-orange-900 hover:bg-orange-50"
                onClick={() => onChoose(recommendation.upgrade.title, recommendation.upgrade.addIngredient)}
                disabled={disabled}
              >
                <ShoppingBasket className="mr-2 h-4 w-4" /> Use the upgraded idea
              </Button>
            </article>
          </div>
          {canSpeak && (
            <Button type="button" variant="ghost" onClick={isSpeaking ? stopSpeaking : () => speak(recommendation)}>
              {isSpeaking ? (
                <><VolumeX className="mr-2 h-4 w-4" /> Stop speaking</>
              ) : (
                <><Volume2 className="mr-2 h-4 w-4" /> Read recommendation aloud</>
              )}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

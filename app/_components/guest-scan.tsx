'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Leaf,
  ArrowRight,
  Lock,
  PiggyBank,
} from 'lucide-react';
import { detectAdditives, type DetectedAdditive } from '@/lib/additives';

interface GuestRecipe {
  title: string;
  freshIngredients: string[];
  instructions: string[];
  estimatedCostPerServing?: number;
  storeBoughtCost?: number;
}

const EXAMPLE =
  'enriched flour, high fructose corn syrup, palm oil, sodium nitrite, artificial flavor, Red 40, BHT, monosodium glutamate';

export function GuestScan() {
  const [ingredients, setIngredients] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<GuestRecipe | null>(null);
  const [additives, setAdditives] = useState<DetectedAdditive[]>([]);
  const [wallMessage, setWallMessage] = useState<string | null>(null);

  const transform = async () => {
    if (!ingredients.trim()) return;
    setLoading(true);
    setRecipe(null);
    setWallMessage(null);
    setAdditives(detectAdditives(ingredients));
    try {
      const res = await fetch('/api/guest/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 429 (out of previews) and 503 (Gemini busy) both carry a friendly,
        // signup-pointing message
        setWallMessage(data?.message || data?.error || 'Something went wrong — please try again.');
        return;
      }
      setRecipe(data.recipe);
    } catch {
      setWallMessage('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const savings =
    recipe &&
    typeof recipe.estimatedCostPerServing === 'number' &&
    typeof recipe.storeBoughtCost === 'number' &&
    recipe.storeBoughtCost > recipe.estimatedCostPerServing
      ? recipe.storeBoughtCost - recipe.estimatedCostPerServing
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-left">
      {!recipe ? (
        <>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
            See the fresh version — free, no signup
          </h2>
          <p className="text-sm text-gray-500 text-center mb-4">
            Paste any ingredient list from a packaged food and watch it transform.
          </p>
          <Textarea
            placeholder="e.g. enriched flour, high fructose corn syrup, palm oil, artificial flavor…"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={4}
            className="resize-none text-gray-900"
            disabled={loading}
          />
          <div className="flex justify-center mt-2 mb-4">
            <button
              type="button"
              onClick={() => setIngredients(EXAMPLE)}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              disabled={loading}
            >
              <Sparkles className="h-4 w-4" />
              No label handy? Try an example
            </button>
          </div>
          <Button
            onClick={transform}
            disabled={loading || !ingredients.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Transforming…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Transform to Fresh
              </>
            )}
          </Button>

          {wallMessage && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center space-y-3">
              <p className="text-sm text-emerald-800">{wallMessage}</p>
              <Link href="/signup">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Sign Up Free
                </Button>
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Transformation reveal */}
          {additives.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch rounded-xl border border-emerald-200 overflow-hidden">
              <div className="p-4 bg-red-50/60">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                    The packaged version
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-600 mb-2">
                  {additives.length} additive{additives.length === 1 ? '' : 's'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {additives.slice(0, 5).map((a) => (
                    <span
                      key={a.name}
                      className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium"
                    >
                      {a.name}
                    </span>
                  ))}
                  {additives.length > 5 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      +{additives.length - 5} more
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center py-2 sm:px-2 bg-white">
                <div className="bg-emerald-100 rounded-full p-2">
                  <ArrowRight className="h-5 w-5 text-emerald-600 rotate-90 sm:rotate-0" />
                </div>
              </div>
              <div className="p-4 bg-emerald-50/60">
                <div className="flex items-center gap-2 mb-1">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Your fresh version
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 mb-2">0 additives</p>
                <p className="text-sm text-gray-600">Just whole-food ingredients.</p>
              </div>
            </div>
          )}

          {savings !== null && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 rounded-lg">
              <PiggyBank className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                You&apos;d save ~${savings.toFixed(2)} per serving vs. store-bought
              </p>
            </div>
          )}

          {/* Recipe teaser with signup wall */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{recipe.title}</h3>
            <div className="relative">
              <ul className="space-y-1">
                {recipe.freshIngredients.slice(0, 2).map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span className="text-emerald-600 mt-1">•</span>
                    <span>{ing}</span>
                  </li>
                ))}
                {/* Blurred locked remainder */}
                <li className="flex items-start gap-2 text-gray-700 blur-sm select-none" aria-hidden="true">
                  <span className="text-emerald-600 mt-1">•</span>
                  <span>{recipe.freshIngredients[2] || 'Fresh whole-food ingredient'}</span>
                </li>
                <li className="flex items-start gap-2 text-gray-700 blur-sm select-none" aria-hidden="true">
                  <span className="text-emerald-600 mt-1">•</span>
                  <span>{recipe.freshIngredients[3] || 'Fresh whole-food ingredient'}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center space-y-3">
            <Lock className="h-7 w-7 text-emerald-600 mx-auto" />
            <p className="font-semibold text-gray-900">
              Sign up free to unlock the full recipe
            </p>
            <p className="text-sm text-gray-600">
              Get the complete ingredient list, step-by-step instructions, and save it to your
              collection — 3 free recipes a month, no card required.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Sparkles className="mr-2 h-5 w-5" />
                Sign Up Free to See It
              </Button>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              setRecipe(null);
              setIngredients('');
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            ← Try another product
          </button>
        </div>
      )}
    </div>
  );
}

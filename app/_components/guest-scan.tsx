'use client';

import { useRef, useState } from 'react';
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
  Camera,
  Check,
} from 'lucide-react';
import { detectAdditives, type DetectedAdditive } from '@/lib/additives';
import { EXAMPLE_LABEL as EXAMPLE } from '@/lib/example-label';
import { downscaleImage } from '@/lib/downscale-image';
import { TransformProgress } from './transform-progress';

interface GuestRecipe {
  title: string;
  freshIngredients: string[];
  instructions: string[];
  estimatedCostPerServing?: number;
  storeBoughtCost?: number;
}

export function GuestScan() {
  const [ingredients, setIngredients] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<GuestRecipe | null>(null);
  const [additives, setAdditives] = useState<DetectedAdditive[]>([]);
  const [wallMessage, setWallMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo -> ingredient text. We stop here rather than chaining straight into
  // generation: showing what we read off the label is fast proof the camera
  // worked, and lets the visitor fix any misread before spending a generation.
  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = '';
    if (!file) return;

    setScanning(true);
    setScanError(null);
    setScannedProduct(null);
    setWallMessage(null);

    try {
      const prepared = await downscaleImage(file);
      const body = new FormData();
      body.append('image', prepared);

      const res = await fetch('/api/guest/extract-label', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 429 carries the signup nudge; everything else is a retry hint.
        if (res.status === 429) {
          setWallMessage(data?.message ?? 'Sign up free to keep scanning.');
        } else {
          setScanError(
            data?.message ?? data?.error ?? "We couldn't read that photo. Try again."
          );
        }
        return;
      }

      setIngredients(data.ingredients);
      setScannedProduct(data.productName ?? 'your label');
    } catch {
      setScanError("We couldn't read that photo. Try again, or type the ingredients instead.");
    } finally {
      setScanning(false);
    }
  };

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

  // Carry the visitor's typed ingredients across signup so the generator can
  // hand them the recipe they were promised instead of a blank form. (conversion)
  const stashIngredientsForSignup = () => {
    try {
      sessionStorage.setItem('rr_guest_ingredients', ingredients);
    } catch {
      // sessionStorage unavailable (private mode) — signup still works
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
    <div className="mx-auto w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-5 sm:p-8 text-left">
      {!recipe ? (
        <>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
            See the fresh version — free, no signup
          </h2>
          <p className="text-sm text-gray-500 text-center mb-4">
            Snap a photo of the ingredient label, or paste the list — and watch it transform.
          </p>

          {/* Photo capture. On a phone the OS sheet offers Take Photo or the
              photo library; on desktop it is a normal file picker. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning || loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white text-base py-6 mb-3"
          >
            {scanning ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Reading the label…
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Snap the ingredient label
              </>
            )}
          </Button>

          {scanError && (
            <p className="mb-3 text-center text-sm text-red-600">{scanError}</p>
          )}

          {scannedProduct && (
            <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" />
              Read from {scannedProduct} — check it below, then transform.
            </p>
          )}

          <div className="relative mb-3 flex items-center">
            <div className="flex-grow border-t border-gray-200" />
            <span className="mx-3 flex-shrink text-xs uppercase tracking-wide text-gray-400">
              or type it
            </span>
            <div className="flex-grow border-t border-gray-200" />
          </div>

          <Textarea
            placeholder="e.g. enriched flour, high fructose corn syrup, palm oil, artificial flavor…"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={4}
            className="resize-none text-gray-900"
            disabled={loading || scanning}
            aria-label="Ingredient list from a packaged food"
          />
          <div className="flex justify-center mt-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setIngredients(EXAMPLE);
                setScannedProduct(null);
                setScanError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              disabled={loading || scanning}
            >
              <Sparkles className="h-4 w-4" />
              No label handy? Try an example
            </button>
          </div>
          <Button
            onClick={transform}
            disabled={loading || scanning || !ingredients.trim()}
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

          {/* The additive scan is instant and local, so it lands here while the
              recipe is still generating instead of after it. */}
          {loading && <TransformProgress additives={additives} />}

          {wallMessage && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center space-y-3">
              <p className="text-sm text-emerald-800">{wallMessage}</p>
              <Link href="/signup?unlock=1" onClick={stashIngredientsForSignup}>
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
                    Detected on the label
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-600 mb-2">
                  {additives.length} flagged item{additives.length === 1 ? '' : 's'}
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
                    Generated fresh ingredients
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {recipe.freshIngredients.slice(0, 3).map((ingredient, index) => (
                    <li key={`${ingredient}-${index}`}>• {ingredient}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {savings !== null && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 rounded-lg">
              <PiggyBank className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                AI-estimated cost difference: ~${savings.toFixed(2)} per serving. Actual prices vary.
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
            <Link href="/signup?unlock=1" onClick={stashIngredientsForSignup}>
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
              setScannedProduct(null);
              setScanError(null);
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

"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

interface IngredientImageUploadProps {
  onIngredientsExtracted: (ingredients: string) => void;
}

/**
 * Image upload + OCR component.
 * Users upload a photo of a food ingredient label.
 * Tesseract.js extracts the text in the browser (no API cost).
 */
export default function IngredientImageUpload({
  onIngredientsExtracted,
}: IngredientImageUploadProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setExtractedText(null);

      // Validate
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG, HEIC).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        return;
      }

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // OCR
      setProcessing(true);
      setProgress(0);

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        const result = await worker.recognize(file);
        await worker.terminate();

        const text = result.data.text.trim();
        if (!text) {
          setError(
            "Couldn't read any text from this image. Try a clearer photo of the ingredient label."
          );
          setProcessing(false);
          return;
        }

        // Try to extract ingredient list specifically
        const ingredients = extractIngredientsList(text);
        setExtractedText(ingredients || text);
        onIngredientsExtracted(ingredients || text);
      } catch (err) {
        console.error("OCR failed:", err);
        setError("Couldn't process the image. Please try typing ingredients manually.");
      } finally {
        setProcessing(false);
      }
    },
    [onIngredientsExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = () => {
    setImagePreview(null);
    setExtractedText(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        📸 Upload Ingredient Label Photo
        <span className="ml-2 text-xs font-normal text-gray-500">
          (optional — we&apos;ll read it automatically)
        </span>
      </label>

      {!imagePreview ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
        >
          <svg
            className="mx-auto h-12 w-12 text-emerald-500 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-700 font-medium">
            Tap to upload or drag a photo here
          </p>
          <p className="text-sm text-gray-500 mt-1">
            JPG, PNG, or HEIC · up to 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Ingredient label preview"
              className="w-full max-h-64 object-contain"
            />
            <button
              type="button"
              onClick={reset}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-md transition-colors"
              aria-label="Remove image"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-emerald-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Reading ingredients from image…
                </span>
                <span className="text-emerald-600 font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {extractedText && !processing && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="text-sm">
                  <p className="text-emerald-800 font-medium">
                    Ingredients extracted! Review below:
                  </p>
                  <p className="text-emerald-700 mt-1 whitespace-pre-wrap break-words">
                    {extractedText.length > 200
                      ? extractedText.slice(0, 200) + "…"
                      : extractedText}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

/**
 * Attempt to extract the "Ingredients:" section from OCR'd text.
 * Labels typically have a section starting with "INGREDIENTS:" or "Ingredients:"
 * followed by a comma-separated list.
 */
function extractIngredientsList(text: string): string | null {
  // Normalize
  const normalized = text.replace(/\s+/g, " ").trim();

  // Try to find "Ingredients:" section
  const match = normalized.match(
    /ingredients?\s*[:;]\s*([^.]*?)(?:\.\s*(?:contains|may contain|allergen|distributed|manufactured|net wt|nutrition|serving|calories)|$)/i
  );

  if (match && match[1]) {
    return match[1].trim().replace(/[,;]+$/, "");
  }

  // Fallback: return full text (user can edit)
  return null;
}

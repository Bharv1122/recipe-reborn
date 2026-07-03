// Central AI config — Gemini via its OpenAI-compatible endpoint.
// All chat routes share this; swap provider/models here, not per-route.
export const AI_CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export const AI_API_KEY = process.env.GEMINI_API_KEY ?? '';

// SMART: recipe/meal-plan generation, photo extraction, URL import.
// FAST: chat, substitutions, ingredient info, wine pairing, scaling, nutrition.
export const MODEL_SMART = 'gemini-2.5-flash';
export const MODEL_FAST = 'gemini-2.5-flash-lite';

// Gemini often wraps JSON in markdown fences, and when a response hits the
// max_tokens ceiling the closing fence never arrives — so never require one.
// Extracts the JSON payload from an AI response defensively.
export function extractJsonPayload(content: string): string {
  let s = (content ?? '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  s = fence ? fence[1] : s.replace(/^```(?:json)?\s*/, '');
  const candidates = [s.indexOf('{'), s.indexOf('[')].filter((i) => i !== -1);
  const first = candidates.length ? Math.min(...candidates) : -1;
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (first !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

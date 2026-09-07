export function parseStoredRecipeList(value?: string | null): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        );
      }
    } catch {
      // Older recipes can contain newline-delimited text instead of JSON.
    }
  }

  return trimmed.split('\n').map((item) => item.trim()).filter(Boolean);
}

export const LIBRARY_SOURCES = ['legacy', 'generated', 'imported', 'meal_plan'] as const;
export type LibrarySource = (typeof LIBRARY_SOURCES)[number];

export function isLibrarySource(value: unknown): value is LibrarySource {
  return typeof value === 'string' && LIBRARY_SOURCES.includes(value as LibrarySource);
}

export function saveToLibraryUpdate(savedAt: Date | null, source: string) {
  return savedAt
    ? { savedAt, librarySource: source }
    : { savedAt: new Date(), librarySource: source === 'meal_plan' ? 'generated' : source };
}

export function removeFromLibraryUpdate() {
  // The Recipe row and every plan/collection relation remain intact.
  return { savedAt: null };
}

// Import API payloads use text; generator review controls use arrays.
export function importedRecipeLines(value: unknown): string[] {
  const lines = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return lines.filter((line): line is string => typeof line === 'string').map(line => line.trim()).filter(Boolean);
}

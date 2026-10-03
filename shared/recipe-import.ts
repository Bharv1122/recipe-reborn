// Import API payloads use text; generator review controls use arrays.
export const MISSING_SOURCE_DIRECTIONS = 'No directions were visible in the imported source.';
export function sourceHasDirections(instructions: string[]) {
  return instructions.length > 0 && !(instructions.length === 1 && instructions[0] === MISSING_SOURCE_DIRECTIONS);
}

export function importedRecipeLines(value: unknown): string[] {
  const lines = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return lines.filter((line): line is string => typeof line === 'string').map(line => line.trim()).filter(Boolean);
}

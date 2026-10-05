// Presentation only: never rewrite the saved recipe, quantities or instructions.
const marker = /^(?:(?:step\s*)?\d{1,2}[.):]|[•*-])\s+/i;
const abbreviation = /(?:\b(?:tsp|tbsp|oz|lb|lbs|qt|pt|approx|min|mins|hr|hrs|in|no|vs|dr|mr|mrs)|\be\.g|\bi\.e)\.["')\]]*$/i;

export function displayInstructionSteps(instructions: readonly string[]): string[] {
  const clean = (line: string) => line.trim().replace(marker, '');
  const entries = instructions.map(line => line.trim()).filter(Boolean);
  if (entries.length !== 1) return entries.map(clean);
  const text = entries[0];
  const lines = text.split(/\r?\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map(clean);
  const cuts: number[] = [];
  for (const match of text.matchAll(/(?:^|\s)(?:step\s*)?(\d{1,2})[.):]\s+(?=[A-Z])/gi)) {
    if (Number(match[1]) === cuts.length + 1) cuts.push(match.index!);
  }
  if (cuts.length > 1 && cuts[0] === 0) return cuts.map((at, index) => clean(text.slice(at, cuts[index + 1])));
  const steps: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?]["')\]]*\s+(?=["'(]?[A-Z])/g)) {
    const end = match.index! + match[0].length;
    if (abbreviation.test(text.slice(start, end).trimEnd())) continue;
    steps.push(clean(text.slice(start, end)));
    start = end;
  }
  steps.push(clean(text.slice(start)));
  return steps.filter(Boolean);
}

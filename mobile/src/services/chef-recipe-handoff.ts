import { importDraft, importSnapshot } from './recipe-import';

let pending: ReturnType<typeof importSnapshot> | null = null;
export function stageChefRecipe(value: unknown) { pending = importSnapshot(importDraft(value)); }
export function takeChefRecipe() { const result = pending; pending = null; return result; }

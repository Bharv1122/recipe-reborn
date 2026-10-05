import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { importedRecipeSnapshotSchema } from '@/lib/import-recipe-adaptation';

export class ImportInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const MAX_IMPORT_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORT_TEXT_BYTES = 100 * 1024;
export type ImportPart = { text: string } | { inlineData: { mimeType: string; data: string } };

// Only globally routable IPv4 destinations; pin the checked address for the
// request so DNS rebinding cannot turn a public URL into an internal request.
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}

export async function recipePage(raw: string, hop = 0, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  let url: URL;
  try { url = new URL(raw); } catch { throw new ImportInputError('Enter a valid HTTPS recipe link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new ImportInputError('Use a public HTTPS recipe link without a username or custom port.');
  }
  if (hop > 4) throw new ImportInputError('That link redirects too many times.');
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  signal?.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) {
    throw new ImportInputError('Use a public recipe website.');
  }
  const result = await new Promise<{ redirect?: string; text?: string }>((resolve, reject) => {
    const req = httpsRequest(url, {
      signal,
      family: 4,
      headers: { 'User-Agent': 'RecipeReborn/1.0 recipe importer', Accept: 'text/html', 'Accept-Encoding': 'identity' },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, addresses);
        else (callback as unknown as (err: null, address: string, family: number) => void)(null, addresses[0].address, 4);
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
        res.resume(); resolve({ redirect: new URL(res.headers.location, url).href }); return;
      }
      if (res.statusCode !== 200 || !String(res.headers['content-type']).includes('text/html')) {
        console.warn('[recipe-import] website response', { status: res.statusCode, html: String(res.headers['content-type']).includes('text/html') });
        res.resume(); reject(new ImportInputError([401, 403, 429].includes(res.statusCode ?? 0)
          ? 'This website is blocking automatic import. Copy the recipe into Text, or use a screenshot or PDF with the ingredients and directions.'
          : 'The website did not return a recipe page. Check the link, paste the recipe into Text, or use Photo or File.')); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) req.destroy(new ImportInputError('That page is too large. Upload the recipe as a file or photo.', 413));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => req.destroy(new ImportInputError('The website took too long to respond. Try again.')), 15000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject); req.end();
  });
  if (result.redirect) return recipePage(result.redirect, hop + 1, signal);
  // Keep JSON-LD recipe data; remove styling and executable scripts, never
  // silently clip the remaining source and lose later ingredients or steps.
  const html = result.text ?? '';
  const structured = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  const visible = html.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = `${structured}\n${visible}`;
  if (Buffer.byteLength(text) > MAX_IMPORT_TEXT_BYTES) throw new ImportInputError('That recipe page has too much content. Upload a file or photo containing one recipe.', 413);
  return text;
}

export async function importFile(file: File): Promise<ImportPart> {
  if (!file.size) throw new ImportInputError('The selected file is empty.');
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new ImportInputError('Choose a file under 3 MB.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type.toLowerCase();
  if (mime === 'text/plain' || mime === 'text/markdown' || ((!mime || mime === 'application/octet-stream') && /\.(txt|md)$/i.test(file.name))) {
    if (bytes.length > MAX_IMPORT_TEXT_BYTES) throw new ImportInputError('Text files must be under 100 KB.', 413);
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ImportInputError('Save the text file as UTF-8 and try again.'); }
    if (!text.trim() || text.includes('\0')) throw new ImportInputError('The file does not contain readable recipe text.');
    return { text };
  }
  const detected = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp'
          : null;
  const declared = mime === 'application/octet-stream' || !mime ? detected : mime;
  if (!detected || detected !== declared) throw new ImportInputError('Use a JPEG, PNG, WebP, PDF, or UTF-8 TXT/MD file. The file must match its type.', 415);
  return { inlineData: { mimeType: detected, data: bytes.toString('base64') } };
}

export function normalizeImportedRecipe(value: unknown, allowPartial = false) {
  const raw = value as Record<string, unknown> | null;
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : Array.isArray(v) && v.every(x => typeof x === 'string') ? v.join('\n').trim() : '';
  const sourceTitle = text(raw?.title), title = sourceTitle || 'Imported recipe', ingredients = text(raw?.ingredients), instructions = text(raw?.instructions);
  if (!ingredients) throw new ImportInputError('No ingredient list could be read. Include the ingredients and their amounts in a closer photo, or paste them into Text.', 422);
  if (!instructions && !allowPartial) throw new ImportInputError('The ingredients were readable, but no directions were found. Include the directions or use the ingredients to create a new recipe.', 422);
  if (title.length > 300 || ingredients.length > 30000 || instructions.length > 50000) throw new ImportInputError('This recipe exceeds the supported length.', 422);
  const reviewNotes = [text(raw?.reviewNotes), !sourceTitle ? 'No title was visible. Imported recipe is a temporary name; you can edit it.' : '', !instructions ? 'No cooking directions were visible. No steps have been invented.' : ''].filter(Boolean).join('\n');
  const snapshot = importedRecipeSnapshotSchema.safeParse({
    title, freshIngredients: ingredients.split('\n').map(line => line.trim()).filter(Boolean),
    instructions: instructions ? instructions.split('\n').map(line => line.trim()).filter(Boolean) : ['Directions missing from source'],
    prepTime: text(raw?.prepTime) || 'Not specified', cookTime: text(raw?.cookTime) || 'Not specified',
    servings: text(raw?.servings) || 'Not specified', dietaryTags: [],
  });
  if (!snapshot.success) throw new ImportInputError('This recipe exceeds the supported length. Import a file or photo containing one shorter recipe.', 422);
  return { title, originalIngredients: ingredients, freshIngredients: ingredients, instructions,
    prepTime: text(raw?.prepTime) || 'Not specified', cookTime: text(raw?.cookTime) || 'Not specified',
    servings: text(raw?.servings) || 'Not specified', dietaryTags: [] as string[], reviewNotes, needsDirections: !instructions };
}

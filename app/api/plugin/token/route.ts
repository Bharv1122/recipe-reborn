import { failure, form, json, oauth } from '@/lib/plugin/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try { return json(await oauth().token(await form(request))); }
  catch (error) { return failure(error); }
}

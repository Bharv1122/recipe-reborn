import { failure, form, json, oauth } from '@/lib/plugin/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try { const data = await form(request); await oauth().revoke(data.get('token') || '', data.get('client_id') || ''); return json({}); }
  catch (error) { return failure(error); }
}

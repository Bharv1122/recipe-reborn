import { failure, json, oauth } from '@/lib/plugin/http';
export const dynamic = 'force-dynamic';
export async function GET() { try { return json(oauth().metadata()); } catch (error) { return failure(error); } }

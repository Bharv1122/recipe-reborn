import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { authorizeGet, authorizePost, failure, oauth } from '@/lib/plugin/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return await authorizeGet(request, (await getServerSession(authOptions))?.user?.id ?? null, oauth()); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { return await authorizePost(request, (await getServerSession(authOptions))?.user?.id ?? null, oauth()); }
  catch (error) { return failure(error); }
}

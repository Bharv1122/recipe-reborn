import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backend } from '@/lib/plugin/backend';
import { PluginTools } from '@/lib/plugin/tools';
import { handleMcp } from '@/lib/plugin/mcp';
import { failure, oauth } from '@/lib/plugin/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
async function handle(request: Request) {
  try {
    const auth = oauth();
    return await handleMcp(request, auth, new PluginTools(auth.store, backend), readFileSync(join(process.cwd(), 'plugins/recipe-reborn/ui/panel.html'), 'utf8'));
  } catch (error) { return failure(error); }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;

import { handleMcpPost, methodNotAllowed } from '@/lib/mcp/http';

// Public MCP endpoint for the Muse connector (and any MCP client).
// Read-only tools over the house recipe catalog — see lib/mcp/recipe-server.ts.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleMcpPost(request);
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

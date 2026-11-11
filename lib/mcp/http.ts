import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { createRecipeRebornMcpServer } from '@/lib/mcp/recipe-server';

/**
 * HTTP handling for the public MCP endpoint, kept out of the route file so the
 * local test (scripts/verify-muse-mcp.ts) can drive it without a server.
 *
 * Stateless streamable HTTP: every POST gets a fresh server + transport and
 * a plain JSON response. No sessions to store, nothing to clean up, and it
 * fits Vercel's per-request functions.
 */

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_BATCH = 10;
export const RATE_LIMIT_PER_MINUTE = 60;

// Second line of defense for when Upstash isn't configured or is down
// (lib/rate-limit fails open by design). Per warm instance only, but it still
// stops a single client from hammering one function instance.
const localHits = new Map<string, { count: number; resetAt: number }>();

export function localRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (localHits.size > 5000) {
    for (const [k, v] of Array.from(localHits.entries())) if (v.resetAt <= now) localHits.delete(k);
  }
  const hit = localHits.get(key);
  if (!hit || hit.resetAt <= now) {
    localHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

export function resetLocalRateLimit() {
  localHits.clear();
}

function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function handleMcpPost(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const key = `mcp:${ip}`;
  const local = localRateLimit(key, RATE_LIMIT_PER_MINUTE, 60_000);
  const shared = await rateLimit(key, RATE_LIMIT_PER_MINUTE, 60);
  if (!local || !shared.success) {
    return jsonRpcError(429, -32000, 'Too many requests. Please slow down and try again in a minute.', {
      'Retry-After': '60',
    });
  }

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return jsonRpcError(413, -32600, 'Request body too large.');

  // Read the body ourselves so the size cap holds even without Content-Length.
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonRpcError(413, -32600, 'Request body too large.');
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonRpcError(400, -32700, 'Parse error: body must be JSON-RPC.');
  }
  if (Array.isArray(body) && body.length > MAX_BATCH) {
    return jsonRpcError(400, -32600, `At most ${MAX_BATCH} messages per batch.`);
  }

  const server = createRecipeRebornMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody: body });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    // Log the failure server-side, but never echo internals to the caller.
    console.error('MCP request failed:', error);
    return jsonRpcError(500, -32603, 'Internal error.');
  } finally {
    // Stateless: tear down after the JSON response has been produced.
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  }
}

/** Stateless mode has no server-initiated stream or session to delete. */
export function methodNotAllowed(): Response {
  return jsonRpcError(405, -32000, 'Method not allowed. Send JSON-RPC requests with POST.', { Allow: 'POST' });
}

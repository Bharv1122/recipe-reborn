import { PluginError, PluginOAuth, pluginConfig } from './oauth';
import { productionStore } from './store';

export const oauth = () => new PluginOAuth(pluginConfig(), productionStore());
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers },
});
export function failure(error: unknown) {
  return json({ error: error instanceof PluginError ? error.code : 'temporarily_unavailable' }, error instanceof PluginError ? error.status : 503);
}
export async function form(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new PluginError('invalid_request');
  const reader = request.body?.getReader();
  if (!reader) throw new PluginError('invalid_request');
  let bytes = 0, text = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 8192) { await reader.cancel(); throw new PluginError('request_too_large', 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return new URLSearchParams(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const COOKIE = 'rr-plugin-consent';
export async function authorizeGet(request: Request, userId: string | null, service: PluginOAuth) {
  const url = new URL(request.url);
  if (url.search.length > 6000) throw new PluginError('request_too_large', 413);
  service.validate(url.searchParams);
  if (!userId) return Response.redirect(`${service.config.origin}/login?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`, 303);
  if (!await service.store.limit(`consent:${userId}`, 20, 60)) throw new PluginError('rate_limited', 429);
  const consent = await service.consent(url.searchParams, userId);
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Recipe Reborn</title><style>body{font:18px system-ui;background:#f7f5ed;color:#173d2c;max-width:620px;margin:64px auto;padding:24px}button{padding:14px;margin:8px;font:inherit}li{margin:12px 0}</style><h1>Connect Recipe Reborn</h1><p>Allow <strong>${escape(consent.client)}</strong> to use your signed-in Recipe Reborn account?</p><ul>${consent.scopes.map(s => `<li>${escape(s)}</li>`).join('')}</ul><p>Read permissions expose your selected account data to the connected host. Write permissions allow changes you confirm. AI calls use your existing membership allowance. This does not purchase or upgrade anything.</p><form method="post"><input type="hidden" name="nonce" value="${consent.nonce}"><button name="decision" value="deny">Cancel</button><button name="decision" value="allow">Allow connection</button></form><p>You can disconnect in your host's plugin settings. Disconnecting should revoke the grant; access tokens otherwise expire after 15 minutes.</p></html>`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Set-Cookie': `${COOKIE}=${consent.nonce}; HttpOnly; SameSite=Lax; Path=/api/plugin/authorize; Max-Age=300${service.config.origin.startsWith('https:') ? '; Secure' : ''}` } });
}
export async function authorizePost(request: Request, userId: string | null, service: PluginOAuth) {
  if (!userId) throw new PluginError('login_required', 401);
  if (request.headers.get('origin') !== service.config.origin) throw new PluginError('invalid_origin', 403);
  const data = await form(request), nonce = data.get('nonce') || '';
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!nonce || nonce !== cookie || data.getAll('nonce').length !== 1 || !['allow', 'deny'].includes(data.get('decision') || '')) throw new PluginError('invalid_consent', 403);
  const redirect = await service.authorize(nonce, userId, data.get('decision') === 'allow');
  return new Response(null, { status: 303, headers: { Location: redirect, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/plugin/authorize; Max-Age=0${service.config.origin.startsWith('https:') ? '; Secure' : ''}` } });
}

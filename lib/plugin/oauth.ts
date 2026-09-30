import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { PluginStore } from './store';

export const SCOPES = ['recipes:read', 'recipes:write', 'plans:read', 'plans:write', 'shopping:read', 'shopping:write', 'ai:generate'] as const;
export type PluginConfig = { origin: string; resource: string; clients: Record<string, { name: string; redirectUris: string[] }> };
export type Grant = { userId: string; clientId: string; scopes: string[]; resource: string; expires: number };
export type Principal = Grant & { grantId: string };
export class PluginError extends Error {
  constructor(public code: string, public status = 400, public scopes?: string[]) { super(code); }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('base64url');
export const opaque = () => randomBytes(32).toString('base64url');
const tokenShape = /^[A-Za-z0-9_-]{43}$/;
const clientSchema = z.record(z.string().min(1), z.object({ name: z.string().min(1).max(100), redirectUris: z.array(z.url()).min(1) }));
export function pluginConfig(): PluginConfig {
  const raw = process.env.PLUGIN_ORIGIN;
  if (!raw || process.env.PLUGIN_ENABLED !== 'true') throw new PluginError('plugin_not_configured', 503);
  const origin = new URL(raw);
  const local = ['127.0.0.1', 'localhost'].includes(origin.hostname);
  if (origin.origin !== raw || (!local && origin.protocol !== 'https:') || (process.env.NODE_ENV === 'production' && local)) throw new PluginError('invalid_plugin_origin', 503);
  const clients = clientSchema.parse(JSON.parse(process.env.PLUGIN_OAUTH_CLIENTS || '{}'));
  if (!Object.keys(clients).length) throw new PluginError('no_registered_clients', 503);
  for (const client of Object.values(clients)) for (const uri of client.redirectUris) {
    const u = new URL(uri);
    if (u.hash || u.username || u.password || (u.protocol !== 'https:' && !(local && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))) throw new PluginError('invalid_redirect_configuration', 503);
  }
  return { origin: raw, resource: `${raw}/api/plugin/mcp`, clients };
}
export class PluginOAuth {
  constructor(readonly config: PluginConfig, readonly store: PluginStore, readonly now = () => Date.now()) {}
  metadata() {
    const c = this.config;
    return { issuer: c.origin, authorization_endpoint: `${c.origin}/api/plugin/authorize`, token_endpoint: `${c.origin}/api/plugin/token`,
      revocation_endpoint: `${c.origin}/api/plugin/revoke`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], scopes_supported: SCOPES,
      authorization_response_iss_parameter_supported: true };
  }
  protectedMetadata() { return { resource: this.config.resource, authorization_servers: [this.config.origin], scopes_supported: SCOPES }; }
  challenge() { return `Bearer resource_metadata="${this.config.origin}/.well-known/oauth-protected-resource", scope="recipes:read"`; }
  validate(params: URLSearchParams) {
    for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new PluginError('invalid_request');
    const clientId = params.get('client_id') || '', redirectUri = params.get('redirect_uri') || '';
    const client = this.config.clients[clientId];
    if (!Object.prototype.hasOwnProperty.call(this.config.clients, clientId) || !client.redirectUris.includes(redirectUri)) throw new PluginError('invalid_client');
    if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !tokenShape.test(params.get('code_challenge') || '')) throw new PluginError('invalid_request');
    if (params.get('resource') !== this.config.resource) throw new PluginError('invalid_target');
    const scopes = [...new Set((params.get('scope') || '').split(' ').filter(Boolean))];
    if (!scopes.length || scopes.some(s => !(SCOPES as readonly string[]).includes(s))) throw new PluginError('invalid_scope');
    const state = params.get('state') || '';
    if (!state || state.length > 1024) throw new PluginError('invalid_request');
    return { clientId, redirectUri, scopes, state, challenge: params.get('code_challenge')!, resource: this.config.resource };
  }
  async consent(params: URLSearchParams, userId: string) {
    const request = this.validate(params), nonce = opaque();
    await this.store.put(`consent:${hash(nonce)}`, { request, userId }, 300);
    return { nonce, client: this.config.clients[request.clientId].name, scopes: request.scopes };
  }
  async authorize(nonce: string, userId: string, allow: boolean) {
    const key = `consent:${hash(nonce)}`;
    const entry = await this.store.get<{ request: ReturnType<PluginOAuth['validate']>; userId: string }>(key);
    if (!entry || entry.userId !== userId) throw new PluginError('invalid_consent');
    if (!await this.store.take(key)) throw new PluginError('invalid_consent');
    const url = new URL(entry.request.redirectUri);
    url.searchParams.set('state', entry.request.state); url.searchParams.set('iss', this.config.origin);
    if (!allow) { url.searchParams.set('error', 'access_denied'); return url.toString(); }
    const code = opaque();
    await this.store.put(`code:${hash(code)}`, { ...entry.request, userId }, 120);
    url.searchParams.set('code', code);
    return url.toString();
  }
  private async tokens(grantId: string, grant: Grant) {
    const access = opaque(), refresh = opaque();
    await this.store.put(`access:${hash(access)}`, { grantId, expires: this.now() + 900_000 }, 900);
    await this.store.put(`refresh:${hash(refresh)}`, { grantId, clientId: grant.clientId }, Math.max(1, Math.floor((grant.expires - this.now()) / 1000)));
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 900, scope: grant.scopes.join(' ') };
  }
  async token(params: URLSearchParams) {
    for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new PluginError('invalid_request');
    const clientId = params.get('client_id') || '';
    if (!Object.prototype.hasOwnProperty.call(this.config.clients, clientId)) throw new PluginError('invalid_client');
    if (params.get('resource') !== this.config.resource) throw new PluginError('invalid_target');
    if (!await this.store.limit(`token:${clientId}`, 120, 60)) throw new PluginError('rate_limited', 429);
    if (params.get('grant_type') === 'authorization_code') {
      const code = params.get('code') || '', verifier = params.get('code_verifier') || '';
      if (!tokenShape.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new PluginError('invalid_grant');
      const key = `code:${hash(code)}`;
      const grant = await this.store.get<ReturnType<PluginOAuth['validate']> & { userId: string }>(key);
      if (!grant || grant.clientId !== clientId || grant.redirectUri !== params.get('redirect_uri') || grant.challenge !== hash(verifier)) throw new PluginError('invalid_grant');
      if (!await this.store.take(key)) throw new PluginError('invalid_grant');
      const grantId = opaque();
      const record: Grant = { userId: grant.userId, clientId, scopes: grant.scopes, resource: grant.resource, expires: this.now() + 30 * 86400_000 };
      await this.store.put(`grant:${grantId}`, record, 30 * 86400);
      return this.tokens(grantId, record);
    }
    if (params.get('grant_type') === 'refresh_token') {
      const raw = params.get('refresh_token') || '';
      if (!tokenShape.test(raw)) throw new PluginError('invalid_grant');
      const key = `refresh:${hash(raw)}`;
      const record = await this.store.get<{ grantId: string; clientId: string }>(key);
      if (!record || record.clientId !== clientId) {
        const replay = await this.store.get<{ grantId: string; clientId: string }>(`used:${hash(raw)}`);
        if (replay?.clientId === clientId) await this.store.remove(`grant:${replay.grantId}`);
        throw new PluginError('invalid_grant');
      }
      const grant = await this.store.get<Grant>(`grant:${record.grantId}`);
      if (!grant || grant.expires <= this.now()) throw new PluginError('invalid_grant');
      if (params.has('scope') && params.get('scope') !== grant.scopes.join(' ')) throw new PluginError('invalid_scope');
      await this.store.put(`used:${hash(raw)}`, record, Math.max(1, Math.floor((grant.expires - this.now()) / 1000)));
      if (!await this.store.take(key)) { await this.store.remove(`grant:${record.grantId}`); throw new PluginError('invalid_grant'); }
      return this.tokens(record.grantId, grant);
    }
    throw new PluginError('unsupported_grant_type');
  }
  async authenticate(authorization: string | null): Promise<Principal> {
    const raw = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!tokenShape.test(raw)) throw new PluginError('invalid_token', 401);
    const access = await this.store.get<{ grantId: string; expires: number }>(`access:${hash(raw)}`);
    if (!access || access.expires <= this.now()) throw new PluginError('invalid_token', 401);
    const grant = await this.store.get<Grant>(`grant:${access.grantId}`);
    if (!grant || grant.expires <= this.now() || grant.resource !== this.config.resource) throw new PluginError('invalid_token', 401);
    return { ...grant, grantId: access.grantId };
  }
  async revoke(raw: string, clientId: string) {
    if (!tokenShape.test(raw)) return;
    const entry = await this.store.get<{ grantId: string }>(`access:${hash(raw)}`) || await this.store.get<{ grantId: string }>(`refresh:${hash(raw)}`);
    if (!entry) return;
    const grant = await this.store.get<Grant>(`grant:${entry.grantId}`);
    if (grant?.clientId === clientId) await this.store.remove(`grant:${entry.grantId}`);
  }
}

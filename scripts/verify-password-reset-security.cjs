const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');
let tokenExists = true, updates = 0, revocations = 0, lookups = 0;
let release;
const bothRead = new Promise(resolve => { release = resolve; });
let transactionQueue = Promise.resolve();
const token = { token: 'hash', identifier: 'reset:test@example.com', expires: new Date(Date.now() + 60000) };
const tx = {
  verificationToken: { deleteMany: async ({ where }) => {
    if (!where.token) return { count: 0 };
    assert.equal(where.token, token.token);
    assert.equal(where.identifier, token.identifier);
    assert(where.expires.gt instanceof Date);
    const count = tokenExists ? 1 : 0; tokenExists = false; return { count };
  } },
  user: { update: async () => { updates++; } },
  mobileRefreshToken: { updateMany: async ({ where, data }) => {
    assert.equal(where.userId, 'owner'); assert.equal(where.revokedAt, null);
    assert(data.revokedAt instanceof Date); revocations++; return { count: 2 };
  } },
};
const prisma = {
  verificationToken: { findUnique: async () => { lookups++; if (lookups === 2) release(); return tokenExists ? token : null; } },
  user: { findUnique: async () => ({ id: 'owner' }) },
  $transaction: callback => { const next = transactionQueue.then(() => callback(tx)); transactionQueue = next.catch(() => {}); return next; },
};
const dependencies = {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  bcryptjs: { hash: async () => { await bothRead; return 'new-password-hash'; } },
  '@/lib/db': { prisma },
  '@/lib/rate-limit': { getClientIp: () => 'synthetic', rateLimit: async () => ({ success: true }) },
  '@/lib/password-reset': { MIN_PASSWORD_LENGTH: 8, hashResetToken: () => 'hash', isResetIdentifier: () => true, emailFromResetIdentifier: () => 'test@example.com' },
};
const compiled = esbuild.transformSync(fs.readFileSync('app/api/password-reset/confirm/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
const sandbox = { module: { exports: {} }, Response, Date, console };
sandbox.exports = sandbox.module.exports;
sandbox.require = name => { assert(Object.hasOwn(dependencies, name), name); return dependencies[name]; };
vm.runInNewContext(compiled, sandbox);
const post = () => sandbox.module.exports.POST({ json: async () => ({ token: 'raw-synthetic-token', password: 'synthetic-password' }) });
(async () => {
  const results = await Promise.all([post(), post()]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(updates, 1); assert.equal(revocations, 1);
  assert.equal((await post()).status, 400);
  assert.equal(updates, 1);
  console.log('PASS concurrent reset redemption has one winner, replay fails, and mobile refresh sessions are revoked. No real accounts or email.');
})().catch(error => { console.error(error); process.exitCode = 1; });

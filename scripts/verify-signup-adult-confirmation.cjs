const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

// The actual route runs with isolated repository/rate-limit doubles.
// This creates no account, sends no request, and reads no environment file.
const created = [];
let lookups = 0;
const dependencies = {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  bcryptjs: { hash: async () => 'synthetic-password-hash' },
  '@/lib/db': { prisma: { user: {
    findUnique: async () => { lookups++; return null; },
    create: async ({ data }) => { created.push(data); return { id: 'synthetic-user', ...data }; },
  } } },
  '@/lib/rate-limit': { getClientIp: () => 'test-client', rateLimit: async () => ({ success: true }) },
  '@/lib/partner-offers': {
    resolveSignupAttribution: () => ({ typedOffer: null, signupSource: null }),
    isOfferLive: () => false,
    partnerTrialEndsAt: () => { throw Error('No partner offer in this test'); },
  },
};
const compiled = esbuild.transformSync(fs.readFileSync('app/api/signup/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
const sandbox = { module: { exports: {} }, Response, console, Date };
sandbox.exports = sandbox.module.exports;
sandbox.require = name => {
  assert(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
  return dependencies[name];
};
vm.runInNewContext(compiled, sandbox);
const post = body => sandbox.module.exports.POST({ json: async () => body });

(async () => {
  const valid = { email: 'Synthetic@Example.com', password: 'synthetic-only-password', confirmPassword: 'synthetic-only-password' };
  for (const value of [undefined, false, null, 'true', 1, {}, []]) {
    const response = await post({ ...valid, ...(value === undefined ? {} : { adultConfirmed: value }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /confirm you are 18 or older/);
  }
  assert.equal(created.length, 0, 'Rejected confirmation cannot create an account');
  assert.equal(lookups, 0, 'Rejected confirmation must stop before account lookup');
  const response = await post({ ...valid, adultConfirmed: true });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).user.email, 'synthetic@example.com');
  assert.equal(created.length, 1);
  assert.equal(created[0].password, 'synthetic-password-hash');
  assert.equal(Object.hasOwn(created[0], 'adultConfirmed'), false, 'This is a request confirmation, not a new stored age field');
  assert.equal(Object.hasOwn(created[0], 'dateOfBirth'), false);
  assert.equal((await post({ ...valid, adultConfirmed: true, confirmPassword: 'different' })).status, 400, 'Existing password validation must remain enforced');
  assert.equal(created.length, 1);
  console.log('PASS: actual signup route rejects missing/false/malformed adult confirmation before persistence, accepts literal true, preserves password validation, and stores no birth date or age field. All dependencies isolated.');
})().catch(error => { console.error(error); process.exitCode = 1; });

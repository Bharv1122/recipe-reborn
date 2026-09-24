const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

const dir = mkdtempSync(path.join(tmpdir(), 'rr-shopping-cache-'));
const file = path.join(dir, 'cache.cjs');
function makeDb() {
  const sql = new DatabaseSync(':memory:');
  return {
    execAsync: async (text) => sql.exec(text),
    getAllAsync: async (text, ...params) => sql.prepare(text).all(...params),
    runAsync: async (text, ...params) => sql.prepare(text).run(...params),
    withTransactionAsync: async (operation) => {
      sql.exec('BEGIN');
      try { await operation(); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
    close: () => sql.close(),
  };
}
const lists = () => [{ id: 'list', name: 'Synthetic groceries', updatedAt: '2026-09-23T00:00:00Z', items: [
  { id: 'a', ingredient: 'eggs', checked: false }, { id: 'b', ingredient: 'spinach', checked: false },
] }];
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

(async () => {
  try {
    await esbuild.build({ entryPoints: ['mobile/src/services/shopping-cache.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: file,
      plugins: [{ name: 'mock-api', setup(build) {
        build.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: 'api', namespace: 'mock' }));
        build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const ApiError=globalThis.shoppingTestApiError; export const apiRequest=(...args)=>globalThis.shoppingTestRequest(...args);', loader: 'js' }));
      } }],
    });
    globalThis.shoppingTestApiError = class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } };
    const service = require(file);
    const db = makeDb(); await service.migrateShoppingCache(db); await service.cacheShoppingLists(db, lists());
    const started = deferred(), release = deferred(), requests = [];
    globalThis.shoppingTestRequest = async (url, init) => {
      requests.push({ url, checked: JSON.parse(init.body).checked });
      if (requests.length === 1) { started.resolve(); await release.promise; }
      return { checked: JSON.parse(init.body).checked };
    };
    await service.queueShoppingToggle(db, 'list', 'a', true);
    const flush = service.flushShoppingToggleQueue(db); await started.promise;
    await service.queueShoppingToggle(db, 'list', 'a', false);
    release.resolve(); await flush;
    assert.deepEqual(requests.map(x => x.checked), [true, false], 'The newer toggle must survive the earlier request and then sync.');
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 0);
    assert.equal((await service.readCachedShoppingLists(db))[0].items[0].checked, false);
    console.log('PASS: a toggle changed during sync keeps and sends the newest value.');

    await Promise.all([service.queueShoppingToggle(db, 'list', 'a', true), service.queueShoppingToggle(db, 'list', 'b', true)]);
    assert.deepEqual((await service.readCachedShoppingLists(db))[0].items.map(x => x.checked), [true, true]);
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 2);
    console.log('PASS: simultaneous item changes preserve both local snapshots and queued writes.');

    const secondStarted = deferred(), secondRelease = deferred(); let active = 0, maximum = 0;
    globalThis.shoppingTestRequest = async () => { active++; maximum = Math.max(maximum, active); secondStarted.resolve(); await secondRelease.promise; active--; return {}; };
    const one = service.flushShoppingToggleQueue(db); await secondStarted.promise;
    const two = service.flushShoppingToggleQueue(db); secondRelease.resolve(); await Promise.all([one, two]);
    assert.equal(maximum, 1, 'Overlapping flush calls must not reorder requests.');
    console.log('PASS: overlapping queue flushes share one in-flight operation.');

    await service.queueShoppingToggle(db, 'list', 'a', false);
    const stale = lists(); stale[0].items[0].checked = true; await service.cacheShoppingLists(db, stale);
    assert.equal((await service.readCachedShoppingLists(db))[0].items[0].checked, false, 'A refresh must preserve an unsent local toggle.');
    globalThis.shoppingTestRequest = async () => { throw new Error('Synthetic offline'); };
    await assert.rejects(service.flushShoppingToggleQueue(db), /Synthetic offline/);
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 1);
    globalThis.shoppingTestRequest = async () => ({}); await service.flushShoppingToggleQueue(db);
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 0);
    console.log('PASS: stale refresh preserves local edits and a failed sync remains retryable.');
    const oldFetch = deferred();
    globalThis.shoppingTestRequest = async (url, init) => init?.method === 'PATCH' ? {} : oldFetch.promise;
    const refreshing = service.fetchAndCacheShoppingLists(db);
    await service.queueShoppingToggle(db, 'list', 'a', true);
    await service.flushShoppingToggleQueue(db);
    oldFetch.resolve(lists());
    assert.equal((await refreshing)[0].items[0].checked, true, 'A fetch begun before a completed toggle must not undo it.');
    const signedOutFetch = deferred();
    globalThis.shoppingTestRequest = async () => signedOutFetch.promise;
    const staleAccountRequest = service.fetchAndCacheShoppingLists(db);
    await service.clearShoppingCache(db); signedOutFetch.resolve(lists());
    assert.deepEqual(await staleAccountRequest, [], 'An old response must not restore shopping data after sign-out.');
    assert.deepEqual(await service.readCachedShoppingLists(db), []);
    console.log('PASS: an old fetch cannot overwrite a synced tap or repopulate the cache after sign-out.');

    const accountOneResponse = deferred();
    globalThis.shoppingTestRequest = async () => accountOneResponse.promise;
    const accountOneRequest = service.fetchAndCacheShoppingLists(db);
    await service.clearShoppingCache(db);
    const accountTwoLists = [{ ...lists()[0], id: 'second-account-list', name: 'Second synthetic account', items: [] }];
    await service.cacheShoppingLists(db, accountTwoLists);
    accountOneResponse.resolve(lists());
    assert.deepEqual(await accountOneRequest, accountTwoLists);
    assert.deepEqual(await service.readCachedShoppingLists(db), accountTwoLists);
    console.log('PASS: an old account response cannot replace the next account shopping cache.');

    await service.cacheShoppingLists(db, lists());
    await service.queueShoppingToggle(db, 'list', 'a', true);
    await service.queueShoppingToggle(db, 'list', 'b', true);
    const missingRequests = [];
    globalThis.shoppingTestRequest = async (url) => {
      missingRequests.push(url);
      if (url.endsWith('/a')) throw new globalThis.shoppingTestApiError('Item not found.', 404);
      return {};
    };
    await service.flushShoppingToggleQueue(db);
    assert.equal(missingRequests.length, 2, 'A deleted item must not block later pending changes.');
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 0);
    await service.queueShoppingToggle(db, 'list', 'b', false);
    globalThis.shoppingTestRequest = async () => { throw new globalThis.shoppingTestApiError('Unauthorized', 401); };
    await assert.rejects(service.flushShoppingToggleQueue(db), /Unauthorized/);
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 1, 'Authentication failures must retain pending changes.');
    console.log('PASS: deleted remote items do not block sync; authentication failures retain queued changes.');
    await service.clearShoppingCache(db);
    const unusualListId = 'list/with?query% value', unusualItemId = 'item/#?% space';
    await service.queueShoppingToggle(db, unusualListId, unusualItemId, true);
    let encodedRequest;
    globalThis.shoppingTestRequest = async url => { encodedRequest = url; return {}; };
    await service.flushShoppingToggleQueue(db);
    assert.equal(encodedRequest, '/api/mobile/shopping-lists/list%2Fwith%3Fquery%25%20value/items/item%2F%23%3F%25%20space');
    assert.equal((await db.getAllAsync('SELECT * FROM shopping_toggle_queue')).length, 0);
    console.log('PASS: URL-special characters in persisted shopping IDs remain encoded path components.');
    db.close();
  } finally {
    delete globalThis.shoppingTestRequest;
    delete globalThis.shoppingTestApiError;
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert(path.basename(dir).startsWith('rr-shopping-cache-'));
    rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

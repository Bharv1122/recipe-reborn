const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

const dir = mkdtempSync(path.join(tmpdir(), 'rr-chat-deletion-'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

(async () => {
  const sql = new DatabaseSync(':memory:');
  try {
    const file = path.join(dir, 'history.cjs');
    await esbuild.build({ entryPoints: ['mobile/src/services/chat-history.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: file });
    const service = require(file);
    let pauseInsert = null;
    const db = {
      execAsync: async query => sql.exec(query),
      getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
      runAsync: async (query, ...params) => {
        if (pauseInsert && query.startsWith('INSERT')) {
          const pause = pauseInsert; pauseInsert = null;
          pause.started.resolve(); await pause.release.promise;
        }
        return sql.prepare(query).run(...params);
      },
      withTransactionAsync: async operation => {
        sql.exec('BEGIN');
        try { await operation(); sql.exec('COMMIT'); }
        catch (error) { sql.exec('ROLLBACK'); throw error; }
      },
    };
    const message = content => [{ role: 'user', content }];
    await service.saveChatHistory(db, 'other-account', message('Keep my history'));
    const pause = { started: deferred(), release: deferred() }; pauseInsert = pause;
    const activeSave = service.saveChatHistory(db, 'deleted-account', message('Active write'));
    await pause.started.promise;
    const alreadyQueued = service.saveChatHistory(db, 'deleted-account', message('Queued before deletion'));
    const deleting = service.deleteAccountChatHistory(db, 'deleted-account');
    const delayedComponentSave = service.saveChatHistory(db, 'deleted-account', message('Late component callback'));
    pause.release.resolve();
    await Promise.all([activeSave, alreadyQueued, deleting, delayedComponentSave]);
    assert.deepEqual(await service.loadChatHistory(db, 'deleted-account'), []);
    assert.equal(sql.prepare('SELECT count(*) AS count FROM ai_chef_messages WHERE owner_id = ?').get('deleted-account').count, 0);
    assert.deepEqual(await service.loadChatHistory(db, 'other-account'), message('Keep my history'));
    console.log('PASS: account deletion removes active/queued writes, blocks late saves, and preserves another account.');

    await service.clearChatHistory(db, 'other-account');
    await service.saveChatHistory(db, 'other-account', message('New conversation'));
    assert.deepEqual(await service.loadChatHistory(db, 'other-account'), message('New conversation'));
    console.log('PASS: ordinary clear permits a new conversation.');

    await Promise.all([
      service.saveChatHistory(db, 'new-account', message('first')),
      service.saveChatHistory(db, 'new-account', message('second')),
    ]);
    assert.deepEqual(await service.loadChatHistory(db, 'new-account'), message('second'));
    console.log('PASS: concurrent saves are ordered without overlapping SQLite transactions.');

    const longHistory = Array.from({ length: 48 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message ${i}` }));
    await service.saveChatHistory(db, 'new-account', longHistory);
    assert.deepEqual(await service.loadChatHistory(db, 'new-account'), longHistory.slice(-40));
    console.log('PASS: chronological order and the existing 40-message limit survive the repair.');
  } finally {
    sql.close(); rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

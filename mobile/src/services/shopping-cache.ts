import type { SQLiteDatabase } from 'expo-sqlite';
import { ApiError, apiRequest } from '@/services/api';
import type { ShoppingList } from '@/types';

type PendingToggle = { item_id: string; list_id: string; checked: number; queued_at: string };
const cacheOperations = new WeakMap<SQLiteDatabase, Promise<unknown>>();
const activeFlushes = new WeakMap<SQLiteDatabase, Promise<number>>();
const cacheRevisions = new WeakMap<SQLiteDatabase, number>();

// Expo's async transactions share a connection. Keep snapshot/queue operations
// together so two quick taps cannot read and replace the same old snapshot.
function withCacheAccess<T>(db: SQLiteDatabase, operation: () => Promise<T>): Promise<T> {
  const previous = cacheOperations.get(db) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  cacheOperations.set(db, next.catch(() => undefined));
  return next;
}

async function readSnapshots(db: SQLiteDatabase): Promise<ShoppingList[]> {
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM shopping_snapshots ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.payload) as ShoppingList]; } catch { return []; }
  });
}

async function writeSnapshots(db: SQLiteDatabase, lists: ShoppingList[]) {
  await db.runAsync('DELETE FROM shopping_snapshots');
  for (const list of lists) {
    await db.runAsync(
      'INSERT INTO shopping_snapshots (list_id, payload, updated_at) VALUES (?, ?, ?)',
      list.id, JSON.stringify(list), list.updatedAt || new Date().toISOString(),
    );
  }
}

async function writeServerSnapshot(db: SQLiteDatabase, lists: ShoppingList[]) {
  await db.withTransactionAsync(async () => {
    const queued = await db.getAllAsync<PendingToggle>('SELECT item_id, list_id, checked, queued_at FROM shopping_toggle_queue');
    const pending = new Map(queued.map((item) => [item.item_id, item]));
    await writeSnapshots(db, lists.map((list) => ({
      ...list,
      items: list.items.map((item) => {
        const mutation = pending.get(item.id);
        return mutation?.list_id === list.id ? { ...item, checked: mutation.checked === 1 } : item;
      }),
    })));
  });
}

export async function migrateShoppingCache(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS shopping_snapshots (
      list_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shopping_toggle_queue (
      item_id TEXT PRIMARY KEY NOT NULL,
      list_id TEXT NOT NULL,
      checked INTEGER NOT NULL,
      queued_at TEXT NOT NULL
    );
  `);
}

export async function readCachedShoppingLists(db: SQLiteDatabase): Promise<ShoppingList[]> {
  return withCacheAccess(db, () => readSnapshots(db));
}

export async function cacheShoppingLists(db: SQLiteDatabase, lists: ShoppingList[]) {
  await withCacheAccess(db, () => writeServerSnapshot(db, lists));
}

export async function fetchAndCacheShoppingLists(db: SQLiteDatabase): Promise<ShoppingList[]> {
  const revision = cacheRevisions.get(db) || 0;
  const lists = await apiRequest<ShoppingList[]>('/api/mobile/shopping-lists');
  return withCacheAccess(db, async () => {
    // A fetch started before a tap or sign-out must not restore older state,
    // even if that tap has already been acknowledged and left the queue.
    if ((cacheRevisions.get(db) || 0) === revision) await writeServerSnapshot(db, lists);
    return readSnapshots(db);
  });
}

export async function clearShoppingCache(db: SQLiteDatabase) {
  await withCacheAccess(db, async () => {
    await db.execAsync('DELETE FROM shopping_snapshots; DELETE FROM shopping_toggle_queue;');
    cacheRevisions.set(db, (cacheRevisions.get(db) || 0) + 1);
  });
}

export async function queueShoppingToggle(db: SQLiteDatabase, listId: string, itemId: string, checked: boolean) {
  await withCacheAccess(db, async () => {
    await db.withTransactionAsync(async () => {
      const cached = await readSnapshots(db);
      const next = cached.map((list) => list.id !== listId ? list : ({
        ...list,
        items: list.items.map((item) => item.id === itemId ? { ...item, checked } : item),
      }));
      await writeSnapshots(db, next);
      await db.runAsync(
        `INSERT INTO shopping_toggle_queue (item_id, list_id, checked, queued_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET list_id = excluded.list_id, checked = excluded.checked, queued_at = excluded.queued_at`,
        itemId, listId, checked ? 1 : 0, new Date().toISOString(),
      );
    });
    cacheRevisions.set(db, (cacheRevisions.get(db) || 0) + 1);
  });
}

export async function flushShoppingToggleQueue(db: SQLiteDatabase): Promise<number> {
  const current = activeFlushes.get(db);
  if (current) return current;
  const flush = (async () => {
    let completed = 0;
    while (true) {
      const queued = await withCacheAccess(db, () => db.getAllAsync<PendingToggle>(
        'SELECT item_id, list_id, checked, queued_at FROM shopping_toggle_queue ORDER BY queued_at ASC',
      ));
      if (!queued.length) return completed;
      for (const mutation of queued) {
        try {
          await apiRequest(`/api/mobile/shopping-lists/${encodeURIComponent(mutation.list_id)}/items/${encodeURIComponent(mutation.item_id)}`, {
            method: 'PATCH', body: JSON.stringify({ checked: mutation.checked === 1 }),
          });
        } catch (error) {
          // A list/item deleted on another device cannot be toggled. Let the
          // remaining queue sync and the next fetch remove its old snapshot.
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
        // Remove only the value acknowledged by this request. A later tap may
        // already have replaced the queued row while the network was waiting.
        await withCacheAccess(db, () => db.runAsync(
          'DELETE FROM shopping_toggle_queue WHERE item_id = ? AND list_id = ? AND checked = ? AND queued_at = ?',
          mutation.item_id, mutation.list_id, mutation.checked, mutation.queued_at,
        ));
        completed += 1;
      }
    }
  })();
  activeFlushes.set(db, flush);
  try { return await flush; }
  finally { activeFlushes.delete(db); }
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { apiRequest } from '@/services/api';
import type { ShoppingList } from '@/types';

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
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM shopping_snapshots ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.payload) as ShoppingList]; } catch { return []; }
  });
}

export async function cacheShoppingLists(db: SQLiteDatabase, lists: ShoppingList[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM shopping_snapshots');
    for (const list of lists) {
      await db.runAsync(
        'INSERT INTO shopping_snapshots (list_id, payload, updated_at) VALUES (?, ?, ?)',
        list.id, JSON.stringify(list), list.updatedAt || new Date().toISOString(),
      );
    }
  });
}

export async function fetchAndCacheShoppingLists(db: SQLiteDatabase): Promise<ShoppingList[]> {
  const lists = await apiRequest<ShoppingList[]>('/api/mobile/shopping-lists');
  await cacheShoppingLists(db, lists);
  return lists;
}

export async function clearShoppingCache(db: SQLiteDatabase) {
  await db.execAsync('DELETE FROM shopping_snapshots; DELETE FROM shopping_toggle_queue;');
}

export async function queueShoppingToggle(db: SQLiteDatabase, listId: string, itemId: string, checked: boolean) {
  const cached = await readCachedShoppingLists(db);
  const next = cached.map((list) => list.id !== listId ? list : ({
    ...list,
    items: list.items.map((item) => item.id === itemId ? { ...item, checked } : item),
  }));
  await cacheShoppingLists(db, next);
  await db.runAsync(
    `INSERT INTO shopping_toggle_queue (item_id, list_id, checked, queued_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET checked = excluded.checked, queued_at = excluded.queued_at`,
    itemId, listId, checked ? 1 : 0, new Date().toISOString(),
  );
}

export async function flushShoppingToggleQueue(db: SQLiteDatabase): Promise<number> {
  const queued = await db.getAllAsync<{ item_id: string; list_id: string; checked: number }>(
    'SELECT item_id, list_id, checked FROM shopping_toggle_queue ORDER BY queued_at ASC',
  );
  let completed = 0;
  for (const mutation of queued) {
    await apiRequest(`/api/mobile/shopping-lists/${mutation.list_id}/items/${mutation.item_id}`, {
      method: 'PATCH', body: JSON.stringify({ checked: mutation.checked === 1 }),
    });
    await db.runAsync('DELETE FROM shopping_toggle_queue WHERE item_id = ?', mutation.item_id);
    completed += 1;
  }
  return completed;
}

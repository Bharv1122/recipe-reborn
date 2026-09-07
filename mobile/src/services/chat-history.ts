import type { SQLiteDatabase } from 'expo-sqlite';

export interface StoredChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_LIMIT = 40;

export async function loadChatHistory(db: SQLiteDatabase, ownerId: string): Promise<StoredChatMessage[]> {
  await ensureChatHistoryTable(db);
  const rows = await db.getAllAsync<StoredChatMessage & { id: number }>(
    `SELECT id, role, content
     FROM ai_chef_messages
     WHERE owner_id = ?
     ORDER BY id DESC
     LIMIT ?`,
    ownerId,
    HISTORY_LIMIT,
  );
  return rows.reverse().map(({ role, content }) => ({ role, content }));
}

export async function saveChatHistory(db: SQLiteDatabase, ownerId: string, messages: StoredChatMessage[]) {
  await ensureChatHistoryTable(db);
  const recentMessages = messages.slice(-HISTORY_LIMIT);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM ai_chef_messages WHERE owner_id = ?', ownerId);
    for (const message of recentMessages) {
      await db.runAsync(
        'INSERT INTO ai_chef_messages (owner_id, role, content) VALUES (?, ?, ?)',
        ownerId,
        message.role,
        message.content,
      );
    }
  });
}

export async function clearChatHistory(db: SQLiteDatabase, ownerId: string) {
  await ensureChatHistoryTable(db);
  await db.runAsync('DELETE FROM ai_chef_messages WHERE owner_id = ?', ownerId);
}

async function ensureChatHistoryTable(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ai_chef_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_chef_messages_owner_id_idx ON ai_chef_messages(owner_id);
  `);
}

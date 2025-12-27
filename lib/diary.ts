import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export interface Diary {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

let db: SQLite.SQLiteDatabase | null = null;

export function setDatabase(database: SQLite.SQLiteDatabase) {
  db = database;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('diary.db');
  }
  return db;
}

const CURRENT_DB_VERSION = 2;

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  // Check current version
  const versionResult = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < 1) {
    // Initial schema (v1) - but we're now at v2, so create with UUID from start
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS diaries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  if (currentVersion === 1) {
    // Migration from v1 (INTEGER id) to v2 (TEXT/UUID id)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS diaries_new (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO diaries_new (id, date, content, created_at, updated_at)
        SELECT CAST(id AS TEXT), date, content, created_at, updated_at FROM diaries;
      DROP TABLE diaries;
      ALTER TABLE diaries_new RENAME TO diaries;
    `);
  }

  // Update version
  if (currentVersion < CURRENT_DB_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
  }
}

export async function createDiary(date: string, content: string): Promise<Diary> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO diaries (id, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, date, content, now, now]
  );
  return {
    id,
    date,
    content,
    created_at: now,
    updated_at: now,
  };
}

export async function getDiaries(): Promise<Diary[]> {
  const database = await getDatabase();
  const diaries = await database.getAllAsync<Diary>(
    'SELECT * FROM diaries ORDER BY date DESC'
  );
  return diaries;
}

export async function getDiary(id: string): Promise<Diary | null> {
  const database = await getDatabase();
  const diary = await database.getFirstAsync<Diary>(
    'SELECT * FROM diaries WHERE id = ?',
    [id]
  );
  return diary || null;
}

export async function updateDiary(
  id: string,
  date: string,
  content: string
): Promise<boolean> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'UPDATE diaries SET date = ?, content = ?, updated_at = ? WHERE id = ?',
    [date, content, now, id]
  );
  return result.changes > 0;
}

export async function deleteDiary(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  return result.changes > 0;
}

import * as SQLite from 'expo-sqlite';

export interface Diary {
  id: number;
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

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export async function createDiary(date: string, content: string): Promise<Diary> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO diaries (date, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [date, content, now, now]
  );
  return {
    id: result.lastInsertRowId,
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

export async function getDiary(id: number): Promise<Diary | null> {
  const database = await getDatabase();
  const diary = await database.getFirstAsync<Diary>(
    'SELECT * FROM diaries WHERE id = ?',
    [id]
  );
  return diary || null;
}

export async function updateDiary(
  id: number,
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

export async function deleteDiary(id: number): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  return result.changes > 0;
}

import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';

export interface Diary {
  id: string;
  title: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function createDiary(title: string, date: string, content: string): Promise<Diary> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO diaries (id, title, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, date, content, now, now]
  );
  return {
    id,
    title,
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
  title: string,
  date: string,
  content: string
): Promise<boolean> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'UPDATE diaries SET title = ?, date = ?, content = ?, updated_at = ? WHERE id = ?',
    [title, date, content, now, id]
  );
  return result.changes > 0;
}

export async function deleteDiary(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  return result.changes > 0;
}

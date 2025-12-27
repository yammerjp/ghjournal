import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  shortName?: string;
}

export interface Diary {
  id: string;
  title: string;
  date: string;
  content: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  location_short_name: string | null;
  weather: string | null;
  created_at: string;
  updated_at: string;
}

export async function createDiary(
  title: string,
  date: string,
  content: string,
  location?: Location,
  weather?: string
): Promise<Diary> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO diaries (id, title, date, content, latitude, longitude, location_name, location_short_name, weather, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, date, content, location?.latitude ?? null, location?.longitude ?? null, location?.name ?? null, location?.shortName ?? null, weather ?? null, now, now]
  );
  return {
    id,
    title,
    date,
    content,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    location_name: location?.name ?? null,
    location_short_name: location?.shortName ?? null,
    weather: weather ?? null,
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
  content: string,
  location?: Location | null,
  weather?: string | null
): Promise<boolean> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'UPDATE diaries SET title = ?, date = ?, content = ?, latitude = ?, longitude = ?, location_name = ?, location_short_name = ?, weather = ?, updated_at = ? WHERE id = ?',
    [title, date, content, location?.latitude ?? null, location?.longitude ?? null, location?.name ?? null, location?.shortName ?? null, weather ?? null, now, id]
  );
  return result.changes > 0;
}

export async function deleteDiary(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  return result.changes > 0;
}

import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  shortName?: string;
}

export interface Weather {
  wmoCode: number;
  description: string;
  temperatureMin: number;
  temperatureMax: number;
}

export interface Diary {
  id: string;
  title: string;
  date: string;
  content: string;
  location_latitude: number | null;
  location_longitude: number | null;
  location_description: string | null;
  location_city: string | null;
  weather_wmo_code: number | null;
  weather_description: string | null;
  weather_temperature_min: number | null;
  weather_temperature_max: number | null;
  created_at: string;
  updated_at: string;
}

export async function createDiary(
  title: string,
  date: string,
  content: string,
  location?: Location,
  weather?: Weather
): Promise<Diary> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO diaries (id, title, date, content, location_latitude, location_longitude, location_description, location_city, weather_wmo_code, weather_description, weather_temperature_min, weather_temperature_max, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, date, content, location?.latitude ?? null, location?.longitude ?? null, location?.name ?? null, location?.shortName ?? null, weather?.wmoCode ?? null, weather?.description ?? null, weather?.temperatureMin ?? null, weather?.temperatureMax ?? null, now, now]
  );
  return {
    id,
    title,
    date,
    content,
    location_latitude: location?.latitude ?? null,
    location_longitude: location?.longitude ?? null,
    location_description: location?.name ?? null,
    location_city: location?.shortName ?? null,
    weather_wmo_code: weather?.wmoCode ?? null,
    weather_description: weather?.description ?? null,
    weather_temperature_min: weather?.temperatureMin ?? null,
    weather_temperature_max: weather?.temperatureMax ?? null,
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
  weather?: Weather | null
): Promise<boolean> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'UPDATE diaries SET title = ?, date = ?, content = ?, location_latitude = ?, location_longitude = ?, location_description = ?, location_city = ?, weather_wmo_code = ?, weather_description = ?, weather_temperature_min = ?, weather_temperature_max = ?, updated_at = ? WHERE id = ?',
    [title, date, content, location?.latitude ?? null, location?.longitude ?? null, location?.name ?? null, location?.shortName ?? null, weather?.wmoCode ?? null, weather?.description ?? null, weather?.temperatureMin ?? null, weather?.temperatureMax ?? null, now, id]
  );
  return result.changes > 0;
}

export async function deleteDiary(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  return result.changes > 0;
}

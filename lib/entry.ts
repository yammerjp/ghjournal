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

export interface Entry {
  id: string;
  date: string;
  title: string;
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
  sync_status: 'committed' | 'uncommitted';
  synced_sha: string | null;
}

interface SaveEntryParams {
  id: string | null;
  title: string;
  date: string;
  content: string;
  location?: Location;
  weather?: Weather;
}

interface SaveEntryResult {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveEntry(params: SaveEntryParams): Promise<SaveEntryResult> {
  const database = await getDatabase();
  const id = params.id ?? Crypto.randomUUID();
  const now = new Date().toISOString();

  // Get existing entry to preserve created_at
  let createdAt = now;
  if (params.id) {
    const existing = await database.getFirstAsync<Entry>(
      'SELECT created_at FROM entries WHERE id = ?',
      [params.id]
    );
    if (existing) {
      createdAt = existing.created_at;
    }
  }

  await database.runAsync(
    `INSERT OR REPLACE INTO entries
     (id, date, title, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, created_at, updated_at,
      sync_status, synced_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.date,
      params.title,
      params.content,
      params.location?.latitude ?? null,
      params.location?.longitude ?? null,
      params.location?.name ?? null,
      params.location?.shortName ?? null,
      params.weather?.wmoCode ?? null,
      params.weather?.description ?? null,
      params.weather?.temperatureMin ?? null,
      params.weather?.temperatureMax ?? null,
      createdAt,
      now,
      'uncommitted',
      null,
    ]
  );

  return {
    id,
    createdAt,
    updatedAt: now,
  };
}

export async function getEntry(id: string): Promise<Entry | null> {
  const database = await getDatabase();
  const entry = await database.getFirstAsync<Entry>(
    'SELECT * FROM entries WHERE id = ?',
    [id]
  );
  return entry || null;
}

export async function getEntryByDate(date: string): Promise<Entry | null> {
  const database = await getDatabase();
  const entry = await database.getFirstAsync<Entry>(
    'SELECT * FROM entries WHERE date = ?',
    [date]
  );
  return entry || null;
}

export async function getEntries(): Promise<Entry[]> {
  const database = await getDatabase();
  const entries = await database.getAllAsync<Entry>(
    'SELECT * FROM entries ORDER BY date DESC'
  );
  return entries;
}

export async function deleteEntry(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
  return result.changes > 0;
}

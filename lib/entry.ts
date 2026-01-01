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

  // Get existing entry to preserve created_at and handle date changes
  let createdAt = now;
  if (params.id) {
    const existing = await database.getFirstAsync<Entry>(
      'SELECT created_at, date, synced_sha FROM entries WHERE id = ?',
      [params.id]
    );
    if (existing) {
      createdAt = existing.created_at;

      // If date changed and entry was synced, mark old date for deletion
      if (existing.date !== params.date && existing.synced_sha) {
        await addPendingDeletion(existing.date, existing.synced_sha);
      }
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

export async function getEntryDates(): Promise<string[]> {
  const database = await getDatabase();
  const results = await database.getAllAsync<{ date: string }>(
    'SELECT date FROM entries ORDER BY date DESC'
  );
  return results.map(r => r.date);
}

export async function deleteEntry(id: string): Promise<boolean> {
  const database = await getDatabase();

  // Get entry before deleting to check if it was synced
  const entry = await database.getFirstAsync<Entry>(
    'SELECT date, synced_sha FROM entries WHERE id = ?',
    [id]
  );

  if (entry?.synced_sha) {
    // Record pending deletion for sync
    await addPendingDeletion(entry.date, entry.synced_sha);
  }

  const result = await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Delete entry locally without adding to pending_deletions
 * Used when syncing deletions from remote (already deleted on remote)
 */
export async function deleteEntryLocal(id: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
  return result.changes > 0;
}

// Pending deletions management
export interface PendingDeletion {
  date: string;
  synced_sha: string;
  created_at: string;
}

export async function addPendingDeletion(date: string, syncedSha: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT OR REPLACE INTO pending_deletions (date, synced_sha, created_at) VALUES (?, ?, ?)',
    [date, syncedSha, now]
  );
}

export async function getPendingDeletions(): Promise<PendingDeletion[]> {
  const database = await getDatabase();
  return await database.getAllAsync<PendingDeletion>(
    'SELECT * FROM pending_deletions'
  );
}

export async function removePendingDeletion(date: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM pending_deletions WHERE date = ?', [date]);
}

export async function isPendingDeletion(date: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_deletions WHERE date = ?',
    [date]
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Save a full Entry object directly (used for sync from remote)
 * This preserves all fields including created_at, updated_at from the Entry
 */
export async function saveEntryRaw(entry: Entry): Promise<void> {
  const database = await getDatabase();

  await database.runAsync(
    `INSERT OR REPLACE INTO entries
     (id, date, title, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, created_at, updated_at,
      sync_status, synced_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.date,
      entry.title,
      entry.content,
      entry.location_latitude,
      entry.location_longitude,
      entry.location_description,
      entry.location_city,
      entry.weather_wmo_code,
      entry.weather_description,
      entry.weather_temperature_min,
      entry.weather_temperature_max,
      entry.created_at,
      entry.updated_at,
      entry.sync_status,
      entry.synced_sha,
    ]
  );
}

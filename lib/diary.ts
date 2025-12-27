import * as Crypto from 'expo-crypto';
import { getLocalDatabase, getStreamDatabase } from './database';

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
  diary_id: string;
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
  archived_at: string | null;
  created_at: string;
}

export interface Draft {
  diary_id: string;
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
  sealed_at: string | null;
  pending_version_id: string | null;
}

interface SaveDraftParams {
  diaryId: string | null;
  title: string;
  date: string;
  content: string;
  location?: Location;
  weather?: Weather;
}

interface SaveDraftResult {
  diaryId: string;
  createdAt: string;
  updatedAt: string;
}

interface SealDraftResult {
  sealedAt: string;
  pendingVersionId: string;
}

// Track created_at for drafts (in-memory cache to preserve across updates)
const draftCreatedAtCache: Map<string, string> = new Map();

export async function saveDraft(params: SaveDraftParams): Promise<SaveDraftResult> {
  const database = await getLocalDatabase();
  const diaryId = params.diaryId ?? Crypto.randomUUID();
  const now = new Date().toISOString();

  // Check if draft is sealed - if so, don't update
  if (params.diaryId) {
    const existing = await database.getFirstAsync<Draft>(
      'SELECT sealed_at, created_at FROM diary_drafts WHERE diary_id = ?',
      [params.diaryId]
    );
    if (existing?.sealed_at) {
      // Draft is sealed, return existing info without updating
      return {
        diaryId: params.diaryId,
        createdAt: existing.created_at,
        updatedAt: existing.created_at, // Return same as created since we didn't update
      };
    }
  }

  // Get existing createdAt or use cached value or set new
  let createdAt = draftCreatedAtCache.get(diaryId);
  if (!createdAt) {
    const existing = await database.getFirstAsync<Draft>(
      'SELECT created_at FROM diary_drafts WHERE diary_id = ?',
      [diaryId]
    );
    createdAt = existing?.created_at ?? now;
  }
  draftCreatedAtCache.set(diaryId, createdAt);

  await database.runAsync(
    `INSERT OR REPLACE INTO diary_drafts
     (diary_id, title, date, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, created_at, updated_at,
      sealed_at, pending_version_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      diaryId,
      params.title,
      params.date,
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
      null, // sealed_at
      null, // pending_version_id
    ]
  );

  return {
    diaryId,
    createdAt,
    updatedAt: now,
  };
}

export async function getDraft(diaryId: string): Promise<Draft | null> {
  const database = await getLocalDatabase();
  const draft = await database.getFirstAsync<Draft>(
    'SELECT * FROM diary_drafts WHERE diary_id = ?',
    [diaryId]
  );
  return draft || null;
}

export async function sealDraft(diaryId: string): Promise<SealDraftResult | null> {
  const database = await getLocalDatabase();

  // Check if draft exists
  const draft = await getDraft(diaryId);
  if (!draft) {
    return null;
  }

  // If already sealed, return existing info
  if (draft.sealed_at && draft.pending_version_id) {
    return {
      sealedAt: draft.sealed_at,
      pendingVersionId: draft.pending_version_id,
    };
  }

  // Seal the draft
  const now = new Date().toISOString();
  const versionId = Crypto.randomUUID();

  await database.runAsync(
    'UPDATE diary_drafts SET sealed_at = ?, pending_version_id = ? WHERE diary_id = ? AND sealed_at IS NULL',
    [now, versionId, diaryId]
  );

  return {
    sealedAt: now,
    pendingVersionId: versionId,
  };
}

export async function getSealedDrafts(): Promise<Draft[]> {
  const database = await getLocalDatabase();
  const drafts = await database.getAllAsync<Draft>(
    'SELECT * FROM diary_drafts WHERE sealed_at IS NOT NULL'
  );
  return drafts;
}

export async function commitSealedDraft(diaryId: string): Promise<boolean> {
  const localDb = await getLocalDatabase();
  const streamDb = await getStreamDatabase();

  // Get the sealed draft
  const draft = await getDraft(diaryId);
  if (!draft || !draft.sealed_at || !draft.pending_version_id) {
    return false;
  }

  const versionId = draft.pending_version_id;
  const now = new Date().toISOString();

  // Step 1: Write version to stream database
  await streamDb.runAsync(
    `INSERT INTO diary_versions
     (id, diary_id, title, date, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, archived_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      diaryId,
      draft.title,
      draft.date,
      draft.content,
      draft.location_latitude,
      draft.location_longitude,
      draft.location_description,
      draft.location_city,
      draft.weather_wmo_code,
      draft.weather_description,
      draft.weather_temperature_min,
      draft.weather_temperature_max,
      null, // archived_at
      now,
    ]
  );

  // Step 2: INSERT IGNORE version to local database
  await localDb.runAsync(
    `INSERT OR IGNORE INTO diary_versions
     (id, diary_id, title, date, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, archived_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      diaryId,
      draft.title,
      draft.date,
      draft.content,
      draft.location_latitude,
      draft.location_longitude,
      draft.location_description,
      draft.location_city,
      draft.weather_wmo_code,
      draft.weather_description,
      draft.weather_temperature_min,
      draft.weather_temperature_max,
      null, // archived_at
      now,
    ]
  );

  // Step 3: Update head
  await localDb.runAsync(
    'INSERT OR REPLACE INTO diary_heads (diary_id, version_id) VALUES (?, ?)',
    [diaryId, versionId]
  );

  // Step 4: Delete draft
  await localDb.runAsync('DELETE FROM diary_drafts WHERE diary_id = ?', [diaryId]);
  draftCreatedAtCache.delete(diaryId);

  return true;
}

export async function commitAllSealedDrafts(): Promise<{ committed: number; failed: number }> {
  const sealedDrafts = await getSealedDrafts();
  let committed = 0;
  let failed = 0;

  for (const draft of sealedDrafts) {
    try {
      const success = await commitSealedDraft(draft.diary_id);
      if (success) {
        committed++;
      }
    } catch {
      failed++;
    }
  }

  return { committed, failed };
}

export async function getDiaries(): Promise<Diary[]> {
  const database = await getLocalDatabase();
  const diaries = await database.getAllAsync<Diary>(
    'SELECT * FROM diaries ORDER BY date DESC'
  );
  return diaries;
}

export async function getDiary(diaryId: string): Promise<Diary | null> {
  const database = await getLocalDatabase();
  const diary = await database.getFirstAsync<Diary>(
    'SELECT * FROM diaries WHERE diary_id = ?',
    [diaryId]
  );
  return diary || null;
}

// Legacy function - use sealDraft + commitSealedDraft instead
export async function commitDraft(diaryId: string): Promise<boolean> {
  const sealed = await sealDraft(diaryId);
  if (!sealed) {
    return false;
  }
  return commitSealedDraft(diaryId);
}

// Get diary for editor - returns draft if exists, otherwise committed version
export async function getDiaryForEdit(diaryId: string): Promise<{
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
  updated_at: string | null;
} | null> {
  // First check for draft (non-sealed)
  const draft = await getDraft(diaryId);
  if (draft && !draft.sealed_at) {
    return {
      title: draft.title,
      date: draft.date,
      content: draft.content,
      location_latitude: draft.location_latitude,
      location_longitude: draft.location_longitude,
      location_description: draft.location_description,
      location_city: draft.location_city,
      weather_wmo_code: draft.weather_wmo_code,
      weather_description: draft.weather_description,
      weather_temperature_min: draft.weather_temperature_min,
      weather_temperature_max: draft.weather_temperature_max,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
    };
  }

  // Otherwise get committed version
  const diary = await getDiary(diaryId);
  if (diary) {
    return {
      title: diary.title,
      date: diary.date,
      content: diary.content,
      location_latitude: diary.location_latitude,
      location_longitude: diary.location_longitude,
      location_description: diary.location_description,
      location_city: diary.location_city,
      weather_wmo_code: diary.weather_wmo_code,
      weather_description: diary.weather_description,
      weather_temperature_min: diary.weather_temperature_min,
      weather_temperature_max: diary.weather_temperature_max,
      created_at: diary.created_at,
      updated_at: null,
    };
  }

  return null;
}

export async function deleteDiary(diaryId: string): Promise<boolean> {
  const database = await getLocalDatabase();
  const now = new Date().toISOString();

  // Delete any existing draft
  await database.runAsync('DELETE FROM diary_drafts WHERE diary_id = ?', [diaryId]);
  draftCreatedAtCache.delete(diaryId);

  // Get current version from head
  const diary = await getDiary(diaryId);
  if (!diary) {
    // No committed version exists, just return true (draft was deleted)
    return true;
  }

  // Create archived version
  const versionId = Crypto.randomUUID();

  await database.runAsync(
    `INSERT INTO diary_versions
     (id, diary_id, title, date, content, location_latitude, location_longitude,
      location_description, location_city, weather_wmo_code, weather_description,
      weather_temperature_min, weather_temperature_max, archived_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      diaryId,
      diary.title,
      diary.date,
      diary.content,
      diary.location_latitude,
      diary.location_longitude,
      diary.location_description,
      diary.location_city,
      diary.weather_wmo_code,
      diary.weather_description,
      diary.weather_temperature_min,
      diary.weather_temperature_max,
      now, // archived_at
      now,
    ]
  );

  // Update head to point to archived version
  await database.runAsync(
    'INSERT OR REPLACE INTO diary_heads (diary_id, version_id) VALUES (?, ?)',
    [diaryId, versionId]
  );

  return true;
}

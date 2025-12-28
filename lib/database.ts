import * as SQLite from 'expo-sqlite';
import { v7 as uuidv7 } from 'uuid';
import localMigrations from './migrations/local.json';
import streamMigrations from './migrations/stream.json';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

let localDb: SQLite.SQLiteDatabase | null = null;
let streamDb: SQLite.SQLiteDatabase | null = null;
let streamId: string | null = null;

// For testing
export function setLocalDatabase(database: SQLite.SQLiteDatabase): void {
  localDb = database;
}

export function setStreamDatabase(database: SQLite.SQLiteDatabase): void {
  streamDb = database;
}

export function resetStreamId(): void {
  streamId = null;
}

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!localDb) {
    localDb = await SQLite.openDatabaseAsync('local.sqlite3');
  }
  return localDb;
}

export async function getStreamDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!streamDb) {
    streamDb = await SQLite.openDatabaseAsync('my_stream.sqlite3');
  }
  return streamDb;
}

export async function getStreamId(): Promise<string> {
  if (!streamId) {
    const localDb = await getLocalDatabase();
    const result = await localDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'current_stream_id'"
    );
    if (result) {
      streamId = result.value;
    } else {
      streamId = uuidv7();
      await localDb.runAsync(
        "INSERT INTO settings (key, value) VALUES ('current_stream_id', ?)",
        [streamId]
      );
    }
  }
  return streamId;
}

async function getCurrentVersion(database: SQLite.SQLiteDatabase): Promise<number> {
  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  return result?.user_version ?? 0;
}

async function setVersion(database: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await database.execAsync(`PRAGMA user_version = ${version}`);
}

async function runMigrations(
  database: SQLite.SQLiteDatabase,
  migrations: Migration[]
): Promise<void> {
  const currentVersion = await getCurrentVersion(database);
  const sortedMigrations = migrations.sort((a, b) => a.version - b.version);
  const pendingMigrations = sortedMigrations.filter(m => m.version > currentVersion);

  for (const migration of pendingMigrations) {
    console.log(`[Migration] Running migration v${migration.version}: ${migration.description}`);
    await database.execAsync(migration.sql);
    await setVersion(database, migration.version);
    console.log(`[Migration] Completed migration v${migration.version}`);
  }
}

export async function initLocalDatabase(): Promise<void> {
  const database = await getLocalDatabase();
  await runMigrations(database, localMigrations as Migration[]);
}

export async function initStreamDatabase(): Promise<void> {
  const database = await getStreamDatabase();
  await runMigrations(database, streamMigrations as Migration[]);
}

// Legacy compatibility - will be removed after migration
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getLocalDatabase();
}

export async function initDatabase(): Promise<void> {
  await initLocalDatabase();
  await initStreamDatabase();
}

export async function getDatabaseVersion(): Promise<number> {
  const database = await getLocalDatabase();
  return getCurrentVersion(database);
}

export async function resetDatabase(): Promise<void> {
  const database = await getLocalDatabase();

  // Get all tables and views
  const objects = await database.getAllAsync<{ name: string; type: string }>(
    "SELECT name, type FROM sqlite_master WHERE (type='table' OR type='view') AND name NOT LIKE 'sqlite_%'"
  );

  // Drop all views first, then tables
  for (const obj of objects.filter(o => o.type === 'view')) {
    await database.execAsync(`DROP VIEW IF EXISTS "${obj.name}"`);
  }
  for (const obj of objects.filter(o => o.type === 'table')) {
    await database.execAsync(`DROP TABLE IF EXISTS "${obj.name}"`);
  }

  // Reset version
  await setVersion(database, 0);

  // Re-run all migrations
  await runMigrations(database, localMigrations as Migration[]);
}

interface DiaryVersionRow {
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

// Import all diary_versions from a stream database into local database
export async function importStreamToLocal(streamDb: SQLite.SQLiteDatabase): Promise<{
  imported: number;
  skipped: number;
}> {
  const localDb = await getLocalDatabase();

  // Read all versions from stream database
  const versions = await streamDb.getAllAsync<DiaryVersionRow>(
    'SELECT * FROM diary_versions'
  );

  let imported = 0;
  let skipped = 0;

  for (const version of versions) {
    // INSERT OR IGNORE into local database
    const result = await localDb.runAsync(
      `INSERT OR IGNORE INTO diary_versions
       (id, diary_id, title, date, content, location_latitude, location_longitude,
        location_description, location_city, weather_wmo_code, weather_description,
        weather_temperature_min, weather_temperature_max, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.diary_id,
        version.title,
        version.date,
        version.content,
        version.location_latitude,
        version.location_longitude,
        version.location_description,
        version.location_city,
        version.weather_wmo_code,
        version.weather_description,
        version.weather_temperature_min,
        version.weather_temperature_max,
        version.archived_at,
        version.created_at,
      ]
    );

    if (result.changes > 0) {
      imported++;

      // Update head if this is a non-archived version
      if (!version.archived_at) {
        // Get current head's created_at
        const currentHead = await localDb.getFirstAsync<{ created_at: string }>(
          `SELECT dv.created_at FROM diary_versions dv
           JOIN diary_heads dh ON dv.id = dh.version_id
           WHERE dh.diary_id = ?`,
          [version.diary_id]
        );

        // Update head if no current head or this version is newer
        if (!currentHead || version.created_at > currentHead.created_at) {
          await localDb.runAsync(
            'INSERT OR REPLACE INTO diary_heads (diary_id, version_id) VALUES (?, ?)',
            [version.diary_id, version.id]
          );
        }
      }
    } else {
      skipped++;
    }
  }

  return { imported, skipped };
}

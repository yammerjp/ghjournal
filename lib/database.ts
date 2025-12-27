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
    const id = await getStreamId();
    streamDb = await SQLite.openDatabaseAsync(`${id}.sqlite3`);
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

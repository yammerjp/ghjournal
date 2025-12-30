import * as SQLite from 'expo-sqlite';
import migrations from './migrations/local.json';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

let db: SQLite.SQLiteDatabase | null = null;

// For testing
export function setDatabase(database: SQLite.SQLiteDatabase): void {
  db = database;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('ghjournal.sqlite3');
  }
  return db;
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
  migrationList: Migration[]
): Promise<void> {
  const currentVersion = await getCurrentVersion(database);
  const sortedMigrations = migrationList.sort((a, b) => a.version - b.version);
  const pendingMigrations = sortedMigrations.filter(m => m.version > currentVersion);

  for (const migration of pendingMigrations) {
    console.log(`[Migration] Running migration v${migration.version}: ${migration.description}`);
    await database.execAsync(migration.sql);
    await setVersion(database, migration.version);
    console.log(`[Migration] Completed migration v${migration.version}`);
  }
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await runMigrations(database, migrations as Migration[]);
}

export async function getDatabaseVersion(): Promise<number> {
  const database = await getDatabase();
  return getCurrentVersion(database);
}

export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();

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
  await runMigrations(database, migrations as Migration[]);
}

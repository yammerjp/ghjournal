import * as SQLite from 'expo-sqlite';
import migrations from './migrations.json';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

let db: SQLite.SQLiteDatabase | null = null;

export function setDatabase(database: SQLite.SQLiteDatabase): void {
  db = database;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('diary.db');
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

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const currentVersion = await getCurrentVersion(database);
  const sortedMigrations = (migrations as Migration[]).sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (migration.version > currentVersion) {
      console.log(`[Migration] Running migration v${migration.version}: ${migration.description}`);
      await database.execAsync(migration.sql);
      await setVersion(database, migration.version);
      console.log(`[Migration] Completed migration v${migration.version}`);
    }
  }
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await runMigrations(database);
}

import * as SQLite from 'expo-sqlite';
import migrations from './migrations.json';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

interface TableInfo {
  name: string;
}

interface ColumnInfo {
  name: string;
  type: string;
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

async function getSchemaInfo(database: SQLite.SQLiteDatabase): Promise<string> {
  const tables = await database.getAllAsync<TableInfo>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  const schemaLines: string[] = [];
  for (const table of tables) {
    const columns = await database.getAllAsync<ColumnInfo>(
      `PRAGMA table_info(${table.name})`
    );
    const columnDefs = columns.map(c => `${c.name}:${c.type}`).join(', ');
    schemaLines.push(`${table.name}(${columnDefs})`);
  }

  return schemaLines.join('\n');
}

async function hasDebugLogsTable(database: SQLite.SQLiteDatabase): Promise<boolean> {
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='debug_logs'"
  );
  return (result?.count ?? 0) > 0;
}

async function writeLog(
  database: SQLite.SQLiteDatabase,
  level: string,
  message: string,
  details?: string
): Promise<void> {
  if (!(await hasDebugLogsTable(database))) {
    return;
  }
  const timestamp = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO debug_logs (timestamp, level, message, details) VALUES (?, ?, ?, ?)',
    [timestamp, level, message, details ?? null]
  );
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const currentVersion = await getCurrentVersion(database);
  const sortedMigrations = (migrations as Migration[]).sort((a, b) => a.version - b.version);

  const pendingMigrations = sortedMigrations.filter(m => m.version > currentVersion);
  if (pendingMigrations.length === 0) {
    return;
  }

  // Log schema before migrations
  const schemaBefore = await getSchemaInfo(database);
  await writeLog(database, 'info', 'Migration started', `Version: ${currentVersion}\nSchema:\n${schemaBefore}`);

  for (const migration of pendingMigrations) {
    await writeLog(database, 'info', `Running migration v${migration.version}`, migration.description);
    console.log(`[Migration] Running migration v${migration.version}: ${migration.description}`);

    try {
      await database.execAsync(migration.sql);
      await setVersion(database, migration.version);
      await writeLog(database, 'info', `Completed migration v${migration.version}`);
      console.log(`[Migration] Completed migration v${migration.version}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await writeLog(database, 'error', `Migration v${migration.version} failed`, errorMessage);
      throw error;
    }
  }

  // Log schema after migrations
  const schemaAfter = await getSchemaInfo(database);
  const finalVersion = await getCurrentVersion(database);
  await writeLog(database, 'info', 'Migration completed', `Version: ${finalVersion}\nSchema:\n${schemaAfter}`);
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await runMigrations(database);
}

export async function getDatabaseVersion(): Promise<number> {
  const database = await getDatabase();
  return getCurrentVersion(database);
}

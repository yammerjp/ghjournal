import {
  initDatabase,
  getDatabase,
  setDatabase,
  resetDatabase,
} from './database';

// Mock migrations
jest.mock('./migrations/local.json', () => [
  {
    version: 1,
    description: 'Create entries table',
    sql: `CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      location_latitude REAL,
      location_longitude REAL,
      location_description TEXT,
      location_city TEXT,
      weather_wmo_code INTEGER,
      weather_description TEXT,
      weather_temperature_min REAL,
      weather_temperature_max REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'uncommitted',
      synced_sha TEXT
    )`,
  },
  {
    version: 2,
    description: 'Create entries indexes',
    sql: `CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
          CREATE INDEX IF NOT EXISTS idx_entries_sync_status ON entries(sync_status)`,
  },
  {
    version: 3,
    description: 'Create attachments table',
    sql: `CREATE TABLE IF NOT EXISTS attachments (
      path TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha TEXT NOT NULL,
      is_downloaded INTEGER NOT NULL DEFAULT 0
    )`,
  },
  {
    version: 4,
    description: 'Create attachments index',
    sql: 'CREATE INDEX IF NOT EXISTS idx_attachments_date ON attachments(date)',
  },
  {
    version: 5,
    description: 'Create settings table',
    sql: 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  },
  {
    version: 6,
    description: 'Create debug_logs table',
    sql: `CREATE TABLE IF NOT EXISTS debug_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT
    )`,
  },
]);

const createMockDb = (initialVersion: number = 0) => {
  let currentVersion = initialVersion;
  const executedSqls: string[] = [];

  return {
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: currentVersion };
      }
      return null;
    }),
    execAsync: jest.fn(async (sql: string) => {
      executedSqls.push(sql);
      if (sql.includes('PRAGMA user_version =')) {
        const match = sql.match(/user_version = (\d+)/);
        if (match) {
          currentVersion = parseInt(match[1], 10);
        }
      }
    }),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    _executedSqls: executedSqls,
    _getCurrentVersion: () => currentVersion,
  };
};

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initDatabase', () => {
    it('should run all migrations from version 0', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      // Check that entries table was created
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS entries')
      )).toBe(true);

      // Check that attachments table was created
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS attachments')
      )).toBe(true);

      // Check that settings table was created
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS settings')
      )).toBe(true);

      // Check that debug_logs table was created
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS debug_logs')
      )).toBe(true);

      // Check final version
      expect(mockDb._getCurrentVersion()).toBe(6);
    });

    it('should run only pending migrations', async () => {
      const mockDb = createMockDb(3);
      setDatabase(mockDb as any);
      await initDatabase();

      // Should not create entries table (version 1)
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS entries')
      )).toBe(false);

      // Should create settings table (version 5)
      expect(mockDb._executedSqls.some((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS settings')
      )).toBe(true);

      expect(mockDb._getCurrentVersion()).toBe(6);
    });

    it('should skip migrations if at latest version', async () => {
      const mockDb = createMockDb(6);
      setDatabase(mockDb as any);
      await initDatabase();

      const migrationSqls = mockDb._executedSqls.filter(
        (sql: string) => !sql.includes('PRAGMA')
      );
      expect(migrationSqls).toHaveLength(0);
    });
  });

  describe('getDatabase', () => {
    it('should return database instance', async () => {
      const mockDb = createMockDb(6);
      setDatabase(mockDb as any);
      await initDatabase();

      const db = await getDatabase();
      expect(db).toBe(mockDb);
    });
  });

  describe('entries table schema', () => {
    it('should have sync_status column with default uncommitted', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const entriesTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS entries')
      );

      expect(entriesTableSql).toContain('sync_status TEXT NOT NULL DEFAULT');
      expect(entriesTableSql).toContain('uncommitted');
    });

    it('should have synced_sha column', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const entriesTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS entries')
      );

      expect(entriesTableSql).toContain('synced_sha TEXT');
    });

    it('should have date as unique', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const entriesTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS entries')
      );

      expect(entriesTableSql).toContain('date TEXT NOT NULL UNIQUE');
    });
  });

  describe('attachments table schema', () => {
    it('should have path as primary key', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const attachmentsTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS attachments')
      );

      expect(attachmentsTableSql).toContain('path TEXT PRIMARY KEY');
    });

    it('should have is_downloaded column with default 0', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const attachmentsTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS attachments')
      );

      expect(attachmentsTableSql).toContain('is_downloaded INTEGER NOT NULL DEFAULT 0');
    });
  });

  describe('settings table', () => {
    it('should use key-value format', async () => {
      const mockDb = createMockDb(0);
      setDatabase(mockDb as any);
      await initDatabase();

      const settingsTableSql = mockDb._executedSqls.find((sql: string) =>
        sql.includes('CREATE TABLE IF NOT EXISTS settings')
      );

      expect(settingsTableSql).toContain('key TEXT PRIMARY KEY');
      expect(settingsTableSql).toContain('value TEXT NOT NULL');
    });
  });
});

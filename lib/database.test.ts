import {
  initLocalDatabase,
  initStreamDatabase,
  getLocalDatabase,
  getStreamDatabase,
  getStreamId,
  setLocalDatabase,
  setStreamDatabase,
  resetStreamId,
} from './database';

// Mock local migrations
jest.mock('./migrations/local.json', () => [
  {
    version: 1,
    description: 'Create diary_versions table',
    sql: 'CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)',
  },
  {
    version: 2,
    description: 'Create diary_heads table',
    sql: 'CREATE TABLE IF NOT EXISTS diary_heads (diary_id TEXT PRIMARY KEY)',
  },
  {
    version: 3,
    description: 'Create diary_drafts table',
    sql: 'CREATE TABLE IF NOT EXISTS diary_drafts (diary_id TEXT PRIMARY KEY)',
  },
]);

// Mock stream migrations
jest.mock('./migrations/stream.json', () => [
  {
    version: 1,
    description: 'Create diary_versions table',
    sql: 'CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)',
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
    resetStreamId();
  });

  describe('Local Database', () => {
    it('should run all local migrations from version 0', async () => {
      const mockDb = createMockDb(0);
      setLocalDatabase(mockDb as any);
      await initLocalDatabase();

      expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)');
      expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_heads (diary_id TEXT PRIMARY KEY)');
      expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_drafts (diary_id TEXT PRIMARY KEY)');
      expect(mockDb._getCurrentVersion()).toBe(3);
    });

    it('should run only pending migrations', async () => {
      const mockDb = createMockDb(1);
      setLocalDatabase(mockDb as any);
      await initLocalDatabase();

      expect(mockDb.execAsync).not.toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)');
      expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_heads (diary_id TEXT PRIMARY KEY)');
      expect(mockDb._getCurrentVersion()).toBe(3);
    });

    it('should skip migrations if at latest version', async () => {
      const mockDb = createMockDb(3);
      setLocalDatabase(mockDb as any);
      await initLocalDatabase();

      const migrationSqls = mockDb._executedSqls.filter(sql => !sql.includes('PRAGMA'));
      expect(migrationSqls).toHaveLength(0);
    });

    it('should return local database instance', async () => {
      const mockDb = createMockDb(3);
      setLocalDatabase(mockDb as any);
      await initLocalDatabase();

      const db = await getLocalDatabase();
      expect(db).toBe(mockDb);
    });
  });

  describe('Stream Database', () => {
    it('should run stream migrations from version 0', async () => {
      const mockDb = createMockDb(0);
      setStreamDatabase(mockDb as any);
      await initStreamDatabase();

      expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)');
      expect(mockDb._getCurrentVersion()).toBe(1);
    });

    it('should not create diary_heads or diary_drafts', async () => {
      const mockDb = createMockDb(0);
      setStreamDatabase(mockDb as any);
      await initStreamDatabase();

      const calls = mockDb._executedSqls;
      expect(calls.some((sql: string) => sql.includes('diary_heads'))).toBe(false);
      expect(calls.some((sql: string) => sql.includes('diary_drafts'))).toBe(false);
    });

    it('should return stream database instance', async () => {
      const mockDb = createMockDb(1);
      setStreamDatabase(mockDb as any);
      await initStreamDatabase();

      const db = await getStreamDatabase();
      expect(db).toBe(mockDb);
    });
  });

  describe('Stream ID', () => {
    it('should return a UUIDv7 format stream ID', async () => {
      const streamId = await getStreamId();
      // UUIDv7: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx (y = 8, 9, a, or b)
      expect(streamId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should return the same stream ID on subsequent calls', async () => {
      const streamId1 = await getStreamId();
      const streamId2 = await getStreamId();
      expect(streamId1).toBe(streamId2);
    });

    it('should generate new ID after reset', async () => {
      const streamId1 = await getStreamId();
      resetStreamId();
      const streamId2 = await getStreamId();
      expect(streamId1).not.toBe(streamId2);
    });
  });
});

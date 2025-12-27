import { initDatabase, setDatabase } from './database';

// Mock migrations.json
jest.mock('./migrations.json', () => [
  {
    version: 1,
    description: 'Create initial table',
    sql: 'CREATE TABLE test (id INTEGER PRIMARY KEY)',
  },
  {
    version: 2,
    description: 'Add column',
    sql: 'ALTER TABLE test ADD COLUMN name TEXT',
  },
  {
    version: 3,
    description: 'Add another column',
    sql: 'ALTER TABLE test ADD COLUMN email TEXT',
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

describe('Database migrations', () => {
  it('should run all migrations from version 0', async () => {
    const mockDb = createMockDb(0);
    setDatabase(mockDb as any);
    await initDatabase();

    expect(mockDb.execAsync).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ALTER TABLE test ADD COLUMN name TEXT');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ALTER TABLE test ADD COLUMN email TEXT');
    expect(mockDb._getCurrentVersion()).toBe(3);
  });

  it('should run only pending migrations from version 1', async () => {
    const mockDb = createMockDb(1);
    setDatabase(mockDb as any);
    await initDatabase();

    expect(mockDb.execAsync).not.toHaveBeenCalledWith('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ALTER TABLE test ADD COLUMN name TEXT');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ALTER TABLE test ADD COLUMN email TEXT');
    expect(mockDb._getCurrentVersion()).toBe(3);
  });

  it('should run no migrations if already at latest version', async () => {
    const mockDb = createMockDb(3);
    setDatabase(mockDb as any);
    await initDatabase();

    const migrationSqls = mockDb._executedSqls.filter(sql => !sql.includes('PRAGMA'));
    expect(migrationSqls).toHaveLength(0);
    expect(mockDb._getCurrentVersion()).toBe(3);
  });

  it('should run migrations in order', async () => {
    const mockDb = createMockDb(0);
    setDatabase(mockDb as any);
    await initDatabase();

    const migrationSqls = mockDb._executedSqls.filter(sql => !sql.includes('PRAGMA'));
    expect(migrationSqls[0]).toBe('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    expect(migrationSqls[1]).toBe('ALTER TABLE test ADD COLUMN name TEXT');
    expect(migrationSqls[2]).toBe('ALTER TABLE test ADD COLUMN email TEXT');
  });
});

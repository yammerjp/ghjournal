import {
  createDiary,
  getDiaries,
  getDiary,
  updateDiary,
  deleteDiary,
} from './diary';
import { initDatabase, setDatabase } from './database';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${Math.random().toString(36).substr(2, 9)}`),
}));

// Mock migrations.json
jest.mock('./migrations.json', () => [
  {
    version: 1,
    description: 'Create diaries table',
    sql: 'CREATE TABLE IF NOT EXISTS diaries (id TEXT PRIMARY KEY)',
  },
]);

// Mock database for testing
const createMockDb = () => {
  const tables: Record<string, any[]> = {};
  let dbVersion = 0;

  return {
    execAsync: jest.fn(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) {
        tables['diaries'] = [];
      }
      if (sql.includes('PRAGMA user_version =')) {
        const match = sql.match(/user_version = (\d+)/);
        if (match) {
          dbVersion = parseInt(match[1], 10);
        }
      }
    }),
    runAsync: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO')) {
        const now = new Date().toISOString();
        tables['diaries'].push({
          id: params[0],
          title: params[1],
          date: params[2],
          content: params[3],
          created_at: now,
          updated_at: now,
        });
        return { changes: 1 };
      }
      if (sql.includes('UPDATE')) {
        const id = params[4];
        const diary = tables['diaries'].find((d) => d.id === id);
        if (diary) {
          diary.title = params[0];
          diary.date = params[1];
          diary.content = params[2];
          diary.updated_at = new Date().toISOString();
        }
        return { changes: diary ? 1 : 0 };
      }
      if (sql.includes('DELETE')) {
        const id = params[0];
        const index = tables['diaries'].findIndex((d) => d.id === id);
        if (index !== -1) {
          tables['diaries'].splice(index, 1);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: dbVersion };
      }
      const id = params?.[0];
      return tables['diaries'].find((d) => d.id === id) || null;
    }),
    getAllAsync: jest.fn(async () => {
      return [...tables['diaries']].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }),
    _tables: tables,
  };
};

describe('Diary CRUD operations', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();
    setDatabase(mockDb as any);
    await initDatabase();
  });

  describe('initDatabase', () => {
    it('should create diaries table', async () => {
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS diaries')
      );
    });
  });

  describe('createDiary', () => {
    it('should create a new diary entry with UUID', async () => {
      const diary = await createDiary('My Title', '2024-01-15', 'Today was a good day');
      expect(diary.id).toMatch(/^uuid-/);
      expect(diary.title).toBe('My Title');
      expect(diary.date).toBe('2024-01-15');
      expect(diary.content).toBe('Today was a good day');
    });

    it('should create multiple diary entries with unique ids', async () => {
      const diary1 = await createDiary('Title 1', '2024-01-15', 'First entry');
      const diary2 = await createDiary('Title 2', '2024-01-16', 'Second entry');
      expect(diary1.id).not.toBe(diary2.id);
    });
  });

  describe('getDiaries', () => {
    it('should return all diaries sorted by date descending', async () => {
      await createDiary('', '2024-01-15', 'Entry 1');
      await createDiary('', '2024-01-17', 'Entry 2');
      await createDiary('', '2024-01-16', 'Entry 3');

      const diaries = await getDiaries();
      expect(diaries).toHaveLength(3);
      expect(diaries[0].date).toBe('2024-01-17');
      expect(diaries[1].date).toBe('2024-01-16');
      expect(diaries[2].date).toBe('2024-01-15');
    });

    it('should return empty array when no diaries exist', async () => {
      const diaries = await getDiaries();
      expect(diaries).toEqual([]);
    });
  });

  describe('getDiary', () => {
    it('should return a specific diary by id', async () => {
      const created = await createDiary('Test Title', '2024-01-15', 'Test entry');
      const diary = await getDiary(created.id);
      expect(diary).not.toBeNull();
      expect(diary?.title).toBe('Test Title');
      expect(diary?.content).toBe('Test entry');
    });

    it('should return null for non-existent id', async () => {
      const diary = await getDiary('non-existent-uuid');
      expect(diary).toBeNull();
    });
  });

  describe('updateDiary', () => {
    it('should update an existing diary', async () => {
      const created = await createDiary('Original Title', '2024-01-15', 'Original content');
      const updated = await updateDiary(created.id, 'Updated Title', '2024-01-16', 'Updated content');
      expect(updated).toBe(true);

      const diary = await getDiary(created.id);
      expect(diary?.title).toBe('Updated Title');
      expect(diary?.date).toBe('2024-01-16');
      expect(diary?.content).toBe('Updated content');
    });

    it('should return false for non-existent diary', async () => {
      const updated = await updateDiary('non-existent-uuid', 'Title', '2024-01-16', 'Content');
      expect(updated).toBe(false);
    });
  });

  describe('deleteDiary', () => {
    it('should delete an existing diary', async () => {
      const created = await createDiary('', '2024-01-15', 'To be deleted');
      const deleted = await deleteDiary(created.id);
      expect(deleted).toBe(true);

      const diaries = await getDiaries();
      expect(diaries).toHaveLength(0);
    });

    it('should return false for non-existent diary', async () => {
      const deleted = await deleteDiary('non-existent-uuid');
      expect(deleted).toBe(false);
    });
  });
});

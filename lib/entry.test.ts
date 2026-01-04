import {
  getEntries,
  getEntry,
  getEntryByDate,
  saveEntry,
  deleteEntry,
  Entry,
  Location,
  Weather,
} from './entry';
import { setDatabase } from './database';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
}));

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
      weather_symbol_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'uncommitted',
      synced_sha TEXT
    )`,
  },
]);

interface EntryRow {
  id: string;
  date: string;
  title: string;
  content: string;
  location_latitude: number | null;
  location_longitude: number | null;
  location_description: string | null;
  location_city: string | null;
  weather_wmo_code: number | null;
  weather_description: string | null;
  weather_temperature_min: number | null;
  weather_temperature_max: number | null;
  weather_symbol_name: string | null;
  created_at: string;
  updated_at: string;
  sync_status: 'committed' | 'uncommitted';
  synced_sha: string | null;
}

const createMockDb = () => {
  const entries: EntryRow[] = [];
  let dbVersion = 1;

  return {
    getFirstAsync: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: dbVersion };
      }
      if (sql.includes('FROM entries WHERE id')) {
        const id = params?.[0] as string;
        return entries.find((e) => e.id === id) || null;
      }
      if (sql.includes('FROM entries WHERE date')) {
        const date = params?.[0] as string;
        return entries.find((e) => e.date === date) || null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM entries')) {
        return [...entries].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
      return [];
    }),
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT OR REPLACE INTO entries')) {
        const existing = entries.findIndex((e) => e.id === params[0]);
        const entry: EntryRow = {
          id: params[0] as string,
          date: params[1] as string,
          title: params[2] as string,
          content: params[3] as string,
          location_latitude: params[4] as number | null,
          location_longitude: params[5] as number | null,
          location_description: params[6] as string | null,
          location_city: params[7] as string | null,
          weather_wmo_code: params[8] as number | null,
          weather_description: params[9] as string | null,
          weather_temperature_min: params[10] as number | null,
          weather_temperature_max: params[11] as number | null,
          weather_symbol_name: params[12] as string | null,
          created_at: params[13] as string,
          updated_at: params[14] as string,
          sync_status: params[15] as 'committed' | 'uncommitted',
          synced_sha: params[16] as string | null,
        };
        if (existing >= 0) {
          entries[existing] = entry;
        } else {
          entries.push(entry);
        }
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM entries')) {
        const id = params[0] as string;
        const index = entries.findIndex((e) => e.id === id);
        if (index >= 0) {
          entries.splice(index, 1);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      return { changes: 0 };
    }),
    execAsync: jest.fn(async () => {}),
    _entries: entries,
  };
};

describe('Entry Module', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    setDatabase(mockDb as unknown as Parameters<typeof setDatabase>[0]);
  });

  describe('saveEntry', () => {
    it('should create a new entry with generated id when id is null', async () => {
      const result = await saveEntry({
        id: null,
        title: 'Test Title',
        date: '2024-01-15',
        content: 'Test content',
      });

      expect(result.id).toMatch(/^uuid-/);
      expect(mockDb._entries).toHaveLength(1);
      expect(mockDb._entries[0].title).toBe('Test Title');
      expect(mockDb._entries[0].sync_status).toBe('uncommitted');
      expect(mockDb._entries[0].synced_sha).toBeNull();
    });

    it('should update existing entry when id is provided', async () => {
      const first = await saveEntry({
        id: null,
        title: 'First Title',
        date: '2024-01-15',
        content: 'First content',
      });

      await saveEntry({
        id: first.id,
        title: 'Updated Title',
        date: '2024-01-15',
        content: 'Updated content',
      });

      expect(mockDb._entries).toHaveLength(1);
      expect(mockDb._entries[0].title).toBe('Updated Title');
    });

    it('should set created_at and updated_at timestamps', async () => {
      const result = await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should preserve created_at on update', async () => {
      const first = await saveEntry({
        id: null,
        title: 'First',
        date: '2024-01-15',
        content: 'Content',
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await saveEntry({
        id: first.id,
        title: 'Updated',
        date: '2024-01-15',
        content: 'Updated content',
      });

      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).not.toBe(first.updatedAt);
    });

    it('should save location data', async () => {
      const location: Location = {
        latitude: 35.6762,
        longitude: 139.6503,
        name: 'Tokyo, Japan',
        shortName: 'Tokyo',
      };

      await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
        location,
      });

      expect(mockDb._entries[0].location_latitude).toBe(35.6762);
      expect(mockDb._entries[0].location_longitude).toBe(139.6503);
      expect(mockDb._entries[0].location_description).toBe('Tokyo, Japan');
      expect(mockDb._entries[0].location_city).toBe('Tokyo');
    });

    it('should save weather data', async () => {
      const weather: Weather = {
        wmoCode: 1,
        description: 'Sunny',
        temperatureMin: 10,
        temperatureMax: 20,
      };

      await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
        weather,
      });

      expect(mockDb._entries[0].weather_wmo_code).toBe(1);
      expect(mockDb._entries[0].weather_description).toBe('Sunny');
      expect(mockDb._entries[0].weather_temperature_min).toBe(10);
      expect(mockDb._entries[0].weather_temperature_max).toBe(20);
    });

    it('should mark entry as uncommitted on save', async () => {
      await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      expect(mockDb._entries[0].sync_status).toBe('uncommitted');
    });

    it('should clear synced_sha on update', async () => {
      // Simulate an entry that was synced
      const entry = await saveEntry({
        id: null,
        title: 'Original',
        date: '2024-01-15',
        content: 'Content',
      });
      mockDb._entries[0].sync_status = 'committed';
      mockDb._entries[0].synced_sha = 'abc123';

      await saveEntry({
        id: entry.id,
        title: 'Updated',
        date: '2024-01-15',
        content: 'Updated content',
      });

      expect(mockDb._entries[0].sync_status).toBe('uncommitted');
      expect(mockDb._entries[0].synced_sha).toBeNull();
    });
  });

  describe('getEntry', () => {
    it('should return entry if exists', async () => {
      const saved = await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const entry = await getEntry(saved.id);
      expect(entry).not.toBeNull();
      expect(entry?.title).toBe('Test');
    });

    it('should return null if entry does not exist', async () => {
      const entry = await getEntry('non-existent-id');
      expect(entry).toBeNull();
    });
  });

  describe('getEntryByDate', () => {
    it('should return entry for date', async () => {
      await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const entry = await getEntryByDate('2024-01-15');
      expect(entry).not.toBeNull();
      expect(entry?.title).toBe('Test');
    });

    it('should return null if no entry for date', async () => {
      const entry = await getEntryByDate('2024-01-15');
      expect(entry).toBeNull();
    });
  });

  describe('getEntries', () => {
    it('should return all entries sorted by date descending', async () => {
      await saveEntry({ id: null, title: 'Jan 15', date: '2024-01-15', content: 'c' });
      await saveEntry({ id: null, title: 'Jan 17', date: '2024-01-17', content: 'c' });
      await saveEntry({ id: null, title: 'Jan 16', date: '2024-01-16', content: 'c' });

      const entries = await getEntries();

      expect(entries).toHaveLength(3);
      expect(entries[0].date).toBe('2024-01-17');
      expect(entries[1].date).toBe('2024-01-16');
      expect(entries[2].date).toBe('2024-01-15');
    });

    it('should return empty array when no entries exist', async () => {
      const entries = await getEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('deleteEntry', () => {
    it('should delete existing entry', async () => {
      const saved = await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      expect(mockDb._entries).toHaveLength(1);
      const result = await deleteEntry(saved.id);
      expect(result).toBe(true);
      expect(mockDb._entries).toHaveLength(0);
    });

    it('should return false if entry does not exist', async () => {
      const result = await deleteEntry('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Entry type', () => {
    it('should have sync_status field', async () => {
      const saved = await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const entry = await getEntry(saved.id);
      expect(entry?.sync_status).toBe('uncommitted');
    });

    it('should have synced_sha field', async () => {
      const saved = await saveEntry({
        id: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const entry = await getEntry(saved.id);
      expect(entry?.synced_sha).toBeNull();
    });
  });
});

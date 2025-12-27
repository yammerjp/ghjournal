import {
  saveDraft,
  getDraft,
  getDiaries,
  getDiary,
  sealDraft,
  commitSealedDraft,
  getSealedDrafts,
  commitAllSealedDrafts,
  deleteDiary,
  Location,
  Weather,
} from './diary';
import { setLocalDatabase, setStreamDatabase, resetStreamId } from './database';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
}));

// Mock local migrations
jest.mock('./migrations/local.json', () => [
  { version: 1, description: 'Create diary_versions table', sql: 'CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)' },
  { version: 2, description: 'Create diary_heads table', sql: 'CREATE TABLE IF NOT EXISTS diary_heads (diary_id TEXT PRIMARY KEY)' },
  { version: 3, description: 'Create diary_drafts table', sql: 'CREATE TABLE IF NOT EXISTS diary_drafts (diary_id TEXT PRIMARY KEY)' },
]);

// Mock stream migrations
jest.mock('./migrations/stream.json', () => [
  { version: 1, description: 'Create diary_versions table', sql: 'CREATE TABLE IF NOT EXISTS diary_versions (id TEXT PRIMARY KEY)' },
]);

interface DraftRow {
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
  created_at: string;
  updated_at: string;
  sealed_at: string | null;
  pending_version_id: string | null;
}

interface VersionRow {
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

interface HeadRow {
  diary_id: string;
  version_id: string;
}

const createMockLocalDb = () => {
  const drafts: DraftRow[] = [];
  const versions: VersionRow[] = [];
  const heads: HeadRow[] = [];
  let dbVersion = 3;

  return {
    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: dbVersion };
      }
      if (sql.includes('FROM diary_drafts')) {
        const diaryId = params?.[0];
        return drafts.find((d) => d.diary_id === diaryId) || null;
      }
      if (sql.includes('FROM diaries')) {
        const diaryId = params?.[0];
        const head = heads.find((h) => h.diary_id === diaryId);
        if (!head) return null;
        const version = versions.find((v) => v.id === head.version_id && !v.archived_at);
        return version || null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM diaries')) {
        return heads
          .map((h) => versions.find((v) => v.id === h.version_id && !v.archived_at))
          .filter(Boolean)
          .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime());
      }
      if (sql.includes('FROM diary_drafts') && sql.includes('sealed_at IS NOT NULL')) {
        return drafts.filter((d) => d.sealed_at !== null);
      }
      return [];
    }),
    runAsync: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT OR REPLACE INTO diary_drafts')) {
        const existing = drafts.findIndex((d) => d.diary_id === params[0]);
        const draft: DraftRow = {
          diary_id: params[0],
          title: params[1],
          date: params[2],
          content: params[3],
          location_latitude: params[4],
          location_longitude: params[5],
          location_description: params[6],
          location_city: params[7],
          weather_wmo_code: params[8],
          weather_description: params[9],
          weather_temperature_min: params[10],
          weather_temperature_max: params[11],
          created_at: params[12],
          updated_at: params[13],
          sealed_at: params[14] ?? null,
          pending_version_id: params[15] ?? null,
        };
        if (existing >= 0) {
          drafts[existing] = draft;
        } else {
          drafts.push(draft);
        }
        return { changes: 1 };
      }
      if (sql.includes('UPDATE diary_drafts SET sealed_at')) {
        const diaryId = params[2];
        const draft = drafts.find((d) => d.diary_id === diaryId);
        if (draft && !draft.sealed_at) {
          draft.sealed_at = params[0];
          draft.pending_version_id = params[1];
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('INSERT INTO diary_versions')) {
        versions.push({
          id: params[0],
          diary_id: params[1],
          title: params[2],
          date: params[3],
          content: params[4],
          location_latitude: params[5],
          location_longitude: params[6],
          location_description: params[7],
          location_city: params[8],
          weather_wmo_code: params[9],
          weather_description: params[10],
          weather_temperature_min: params[11],
          weather_temperature_max: params[12],
          archived_at: params[13],
          created_at: params[14],
        });
        return { changes: 1 };
      }
      if (sql.includes('INSERT OR IGNORE INTO diary_versions')) {
        const existingVersion = versions.find((v) => v.id === params[0]);
        if (!existingVersion) {
          versions.push({
            id: params[0],
            diary_id: params[1],
            title: params[2],
            date: params[3],
            content: params[4],
            location_latitude: params[5],
            location_longitude: params[6],
            location_description: params[7],
            location_city: params[8],
            weather_wmo_code: params[9],
            weather_description: params[10],
            weather_temperature_min: params[11],
            weather_temperature_max: params[12],
            archived_at: params[13],
            created_at: params[14],
          });
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('INSERT OR REPLACE INTO diary_heads')) {
        const existing = heads.findIndex((h) => h.diary_id === params[0]);
        const head: HeadRow = { diary_id: params[0], version_id: params[1] };
        if (existing >= 0) {
          heads[existing] = head;
        } else {
          heads.push(head);
        }
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM diary_drafts')) {
        const index = drafts.findIndex((d) => d.diary_id === params[0]);
        if (index >= 0) {
          drafts.splice(index, 1);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      return { changes: 0 };
    }),
    execAsync: jest.fn(async () => {}),
    _drafts: drafts,
    _versions: versions,
    _heads: heads,
  };
};

const createMockStreamDb = () => {
  const versions: VersionRow[] = [];
  let dbVersion = 1;

  return {
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: dbVersion };
      }
      return null;
    }),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO diary_versions')) {
        const existingVersion = versions.find((v) => v.id === params[0]);
        if (!existingVersion) {
          versions.push({
            id: params[0],
            diary_id: params[1],
            title: params[2],
            date: params[3],
            content: params[4],
            location_latitude: params[5],
            location_longitude: params[6],
            location_description: params[7],
            location_city: params[8],
            weather_wmo_code: params[9],
            weather_description: params[10],
            weather_temperature_min: params[11],
            weather_temperature_max: params[12],
            archived_at: params[13],
            created_at: params[14],
          });
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      return { changes: 0 };
    }),
    execAsync: jest.fn(async () => {}),
    _versions: versions,
  };
};

describe('Diary Module', () => {
  let mockLocalDb: ReturnType<typeof createMockLocalDb>;
  let mockStreamDb: ReturnType<typeof createMockStreamDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStreamId();
    mockLocalDb = createMockLocalDb();
    mockStreamDb = createMockStreamDb();
    setLocalDatabase(mockLocalDb as any);
    setStreamDatabase(mockStreamDb as any);
  });

  describe('saveDraft', () => {
    it('should create a new draft with generated diaryId when id is null', async () => {
      const result = await saveDraft({
        diaryId: null,
        title: 'Test Title',
        date: '2024-01-15',
        content: 'Test content',
      });

      expect(result.diaryId).toMatch(/^uuid-/);
      expect(mockLocalDb._drafts).toHaveLength(1);
      expect(mockLocalDb._drafts[0].title).toBe('Test Title');
      expect(mockLocalDb._drafts[0].sealed_at).toBeNull();
    });

    it('should update existing draft when diaryId is provided', async () => {
      const first = await saveDraft({
        diaryId: null,
        title: 'First Title',
        date: '2024-01-15',
        content: 'First content',
      });

      await saveDraft({
        diaryId: first.diaryId,
        title: 'Updated Title',
        date: '2024-01-15',
        content: 'Updated content',
      });

      expect(mockLocalDb._drafts).toHaveLength(1);
      expect(mockLocalDb._drafts[0].title).toBe('Updated Title');
    });

    it('should set created_at and updated_at timestamps', async () => {
      const result = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should save location data', async () => {
      const location: Location = {
        latitude: 35.6762,
        longitude: 139.6503,
        name: 'Tokyo, Japan',
        shortName: 'Tokyo',
      };

      await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
        location,
      });

      expect(mockLocalDb._drafts[0].location_latitude).toBe(35.6762);
      expect(mockLocalDb._drafts[0].location_city).toBe('Tokyo');
    });

    it('should save weather data', async () => {
      const weather: Weather = {
        wmoCode: 1,
        description: 'Sunny',
        temperatureMin: 10,
        temperatureMax: 20,
      };

      await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
        weather,
      });

      expect(mockLocalDb._drafts[0].weather_wmo_code).toBe(1);
      expect(mockLocalDb._drafts[0].weather_description).toBe('Sunny');
    });
  });

  describe('getDraft', () => {
    it('should return draft if exists', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const draft = await getDraft(saved.diaryId);
      expect(draft).not.toBeNull();
      expect(draft?.title).toBe('Test');
    });

    it('should return null if draft does not exist', async () => {
      const draft = await getDraft('non-existent-id');
      expect(draft).toBeNull();
    });
  });

  describe('sealDraft', () => {
    it('should mark draft as sealed with timestamp and version id', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const result = await sealDraft(saved.diaryId);

      expect(result).not.toBeNull();
      expect(result?.sealedAt).toBeDefined();
      expect(result?.pendingVersionId).toMatch(/^uuid-/);
      expect(mockLocalDb._drafts[0].sealed_at).not.toBeNull();
      expect(mockLocalDb._drafts[0].pending_version_id).not.toBeNull();
    });

    it('should return null if draft does not exist', async () => {
      const result = await sealDraft('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return existing seal info if already sealed', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const first = await sealDraft(saved.diaryId);
      const second = await sealDraft(saved.diaryId);

      expect(first?.pendingVersionId).toBe(second?.pendingVersionId);
      expect(first?.sealedAt).toBe(second?.sealedAt);
    });

    it('should prevent saving to sealed draft', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Original',
        date: '2024-01-15',
        content: 'Content',
      });

      await sealDraft(saved.diaryId);

      // Attempt to update sealed draft should fail or be ignored
      await saveDraft({
        diaryId: saved.diaryId,
        title: 'Updated',
        date: '2024-01-15',
        content: 'Updated content',
      });

      // Draft should still have original content (sealed)
      expect(mockLocalDb._drafts[0].title).toBe('Original');
    });
  });

  describe('commitSealedDraft', () => {
    it('should write version to stream database', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);

      await commitSealedDraft(saved.diaryId);

      expect(mockStreamDb._versions).toHaveLength(1);
      expect(mockStreamDb._versions[0].diary_id).toBe(saved.diaryId);
    });

    it('should INSERT IGNORE version to local database', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);

      await commitSealedDraft(saved.diaryId);

      expect(mockLocalDb._versions).toHaveLength(1);
      expect(mockLocalDb._versions[0].diary_id).toBe(saved.diaryId);
    });

    it('should update diary head', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      const sealed = await sealDraft(saved.diaryId);

      await commitSealedDraft(saved.diaryId);

      expect(mockLocalDb._heads).toHaveLength(1);
      expect(mockLocalDb._heads[0].diary_id).toBe(saved.diaryId);
      expect(mockLocalDb._heads[0].version_id).toBe(sealed?.pendingVersionId);
    });

    it('should delete draft after successful commit', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);

      expect(mockLocalDb._drafts).toHaveLength(1);
      await commitSealedDraft(saved.diaryId);
      expect(mockLocalDb._drafts).toHaveLength(0);
    });

    it('should return false if draft is not sealed', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      const result = await commitSealedDraft(saved.diaryId);
      expect(result).toBe(false);
    });

    it('should return false if draft does not exist', async () => {
      const result = await commitSealedDraft('non-existent-id');
      expect(result).toBe(false);
    });

    it('should be idempotent - running twice should be safe', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);

      await commitSealedDraft(saved.diaryId);
      const result = await commitSealedDraft(saved.diaryId);

      // Second call returns false (draft already deleted)
      expect(result).toBe(false);
      // But no duplicate versions
      expect(mockStreamDb._versions).toHaveLength(1);
      expect(mockLocalDb._versions).toHaveLength(1);
    });
  });

  describe('getSealedDrafts', () => {
    it('should return all sealed drafts', async () => {
      const draft1 = await saveDraft({ diaryId: null, title: 'Draft 1', date: '2024-01-15', content: 'c' });
      const draft2 = await saveDraft({ diaryId: null, title: 'Draft 2', date: '2024-01-16', content: 'c' });
      await saveDraft({ diaryId: null, title: 'Draft 3', date: '2024-01-17', content: 'c' });

      await sealDraft(draft1.diaryId);
      await sealDraft(draft2.diaryId);

      const sealed = await getSealedDrafts();
      expect(sealed).toHaveLength(2);
    });

    it('should return empty array if no sealed drafts', async () => {
      await saveDraft({ diaryId: null, title: 'Draft', date: '2024-01-15', content: 'c' });

      const sealed = await getSealedDrafts();
      expect(sealed).toHaveLength(0);
    });
  });

  describe('commitAllSealedDrafts', () => {
    it('should commit all sealed drafts', async () => {
      const draft1 = await saveDraft({ diaryId: null, title: 'Draft 1', date: '2024-01-15', content: 'c' });
      const draft2 = await saveDraft({ diaryId: null, title: 'Draft 2', date: '2024-01-16', content: 'c' });

      await sealDraft(draft1.diaryId);
      await sealDraft(draft2.diaryId);

      const result = await commitAllSealedDrafts();

      expect(result.committed).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockLocalDb._drafts).toHaveLength(0);
      expect(mockLocalDb._versions).toHaveLength(2);
    });

    it('should be idempotent', async () => {
      const draft1 = await saveDraft({ diaryId: null, title: 'Draft 1', date: '2024-01-15', content: 'c' });
      await sealDraft(draft1.diaryId);

      await commitAllSealedDrafts();
      const result = await commitAllSealedDrafts();

      expect(result.committed).toBe(0);
      expect(mockLocalDb._versions).toHaveLength(1);
    });
  });

  describe('getDiaries', () => {
    it('should return committed diaries', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Committed',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);
      await commitSealedDraft(saved.diaryId);

      const diaries = await getDiaries();
      expect(diaries).toHaveLength(1);
      expect(diaries[0].title).toBe('Committed');
    });

    it('should return empty array when no diaries exist', async () => {
      const diaries = await getDiaries();
      expect(diaries).toEqual([]);
    });
  });

  describe('getDiary', () => {
    it('should return committed version', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);
      await commitSealedDraft(saved.diaryId);

      const diary = await getDiary(saved.diaryId);
      expect(diary).not.toBeNull();
      expect(diary?.title).toBe('Test');
    });

    it('should return null if diary does not exist', async () => {
      const diary = await getDiary('non-existent-id');
      expect(diary).toBeNull();
    });
  });

  describe('deleteDiary', () => {
    it('should create archived version', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);
      await commitSealedDraft(saved.diaryId);

      await deleteDiary(saved.diaryId);

      const archivedVersion = mockLocalDb._versions.find((v) => v.archived_at !== null);
      expect(archivedVersion).toBeDefined();
      expect(archivedVersion?.diary_id).toBe(saved.diaryId);
    });

    it('should delete draft if exists', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });

      expect(mockLocalDb._drafts).toHaveLength(1);
      await deleteDiary(saved.diaryId);
      expect(mockLocalDb._drafts).toHaveLength(0);
    });

    it('should return true on successful delete', async () => {
      const saved = await saveDraft({
        diaryId: null,
        title: 'Test',
        date: '2024-01-15',
        content: 'Content',
      });
      await sealDraft(saved.diaryId);
      await commitSealedDraft(saved.diaryId);

      const result = await deleteDiary(saved.diaryId);
      expect(result).toBe(true);
    });
  });
});

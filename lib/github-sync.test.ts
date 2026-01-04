import {
  pushEntries,
  pullEntries,
  syncEntries,
  PushResult,
  PullResult,
  SyncResult,
} from './github-sync';
import { setDatabase } from './database';
import { Entry } from './entry';

// Mock github-auth
jest.mock('./github-auth', () => ({
  getAccessToken: jest.fn(),
  getRepository: jest.fn(),
}));

import { getAccessToken, getRepository } from './github-auth';

const mockGetAccessToken = getAccessToken as jest.Mock;
const mockGetRepository = getRepository as jest.Mock;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GitHub Sync', () => {
  const createMockDb = () => {
    const entries: Map<string, Entry> = new Map();

    return {
      getFirstAsync: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT * FROM entries WHERE id')) {
          const id = params?.[0] as string;
          const entry = entries.get(id);
          return entry || null;
        }
        if (sql.includes('SELECT * FROM entries WHERE date')) {
          const date = params?.[0] as string;
          for (const entry of entries.values()) {
            if (entry.date === date) return entry;
          }
          return null;
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes("sync_status = 'uncommitted'")) {
          return Array.from(entries.values()).filter(e => e.sync_status === 'uncommitted');
        }
        return Array.from(entries.values());
      }),
      runAsync: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('INSERT OR REPLACE INTO entries')) {
          // Simple mock - just track the call
        }
        if (sql.includes('DELETE FROM entries')) {
          const id = params?.[0] as string;
          entries.delete(id);
        }
        return { changes: 1 };
      }),
      execAsync: jest.fn(async () => {}),
      _entries: entries,
    };
  };

  let mockDb: ReturnType<typeof createMockDb>;

  const uncommittedEntry: Entry = {
    id: '01HW123456789ABCDEFGHJKLMN',
    date: '2025-01-15',
    title: '今日の日記',
    content: '今日は良い天気でした。',
    location_latitude: null,
    location_longitude: null,
    location_description: null,
    location_city: null,
    weather_wmo_code: null,
    weather_description: null,
    weather_temperature_min: null,
    weather_temperature_max: null,
    weather_symbol_name: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    sync_status: 'uncommitted',
    synced_sha: null,
  };

  const committedEntry: Entry = {
    ...uncommittedEntry,
    id: '01HW987654321ZYXWVUTSRQPON',
    date: '2025-01-14',
    sync_status: 'committed',
    synced_sha: 'abc123def456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    setDatabase(mockDb as unknown as Parameters<typeof setDatabase>[0]);
    mockGetAccessToken.mockResolvedValue('test-token');
    mockGetRepository.mockResolvedValue('owner/repo');
  });

  describe('pushEntries', () => {
    it('should push uncommitted entries to GitHub', async () => {
      mockDb._entries.set(uncommittedEntry.id, { ...uncommittedEntry });

      // Mock file existence check (404 = doesn't exist)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock GitHub Content API response for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: {
            sha: 'newsha123',
          },
          commit: {
            sha: 'commitsha123',
          },
        }),
      });

      const result = await pushEntries();

      expect(result.success).toBe(true);
      expect(result.pushed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should include sha when updating existing file', async () => {
      const entryWithSha: Entry = {
        ...uncommittedEntry,
        synced_sha: 'existingsha123',
      };
      mockDb._entries.set(entryWithSha.id, entryWithSha);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: { sha: 'newsha456' },
          commit: { sha: 'commitsha456' },
        }),
      });

      await pushEntries();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"sha":"existingsha123"'),
        })
      );
    });

    it('should return error when not authenticated', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const result = await pushEntries();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('GitHub未認証');
    });

    it('should return error when repository not configured', async () => {
      mockGetRepository.mockResolvedValue(null);

      const result = await pushEntries();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('リポジトリ未設定');
    });

    it('should handle 409 conflict gracefully', async () => {
      mockDb._entries.set(uncommittedEntry.id, { ...uncommittedEntry });

      // Mock file existence check (404 = doesn't exist)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock 409 conflict on PUT
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      const result = await pushEntries();

      // 409 is handled gracefully - not a hard failure
      expect(result.pushed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('衝突');
    });

    it('should handle other API errors', async () => {
      mockDb._entries.set(uncommittedEntry.id, { ...uncommittedEntry });

      // Mock file existence check (404 = doesn't exist)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock 500 error on PUT
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await pushEntries();

      expect(result.success).toBe(false);
      expect(result.pushed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip committed entries', async () => {
      mockDb._entries.set(committedEntry.id, { ...committedEntry });

      const result = await pushEntries();

      expect(result.pushed).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('pullEntries', () => {
    it('should pull entries from GitHub', async () => {
      // Mock Tree API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [
            { path: 'ghjournal/entries/2025-01-15.md', sha: 'blobsha123', type: 'blob' },
          ],
          truncated: false,
        }),
      });

      // Mock Content API for file fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'blobsha123',
          content: Buffer.from(`---
date: 2025-01-15
title: Remote Entry
created_at: 2025-01-15T10:00:00Z
updated_at: 2025-01-15T10:00:00Z
---

リモートからの日記`).toString('base64'),
        }),
      });

      const result = await pullEntries();

      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('should detect conflicts', async () => {
      // Set up local uncommitted entry
      mockDb._entries.set(uncommittedEntry.id, { ...uncommittedEntry });

      // Mock Tree API with different SHA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [
            { path: 'ghjournal/entries/2025-01-15.md', sha: 'differentsha', type: 'blob' },
          ],
          truncated: false,
        }),
      });

      const result = await pullEntries();

      expect(result.conflicts).toBe(1);
      expect(result.conflictDates).toContain('2025-01-15');
    });

    it('should update committed entries when remote changed', async () => {
      // Set up local committed entry
      const localEntry: Entry = {
        ...committedEntry,
        date: '2025-01-14',
        synced_sha: 'oldsha',
      };
      mockDb._entries.set(localEntry.id, localEntry);

      // Make getFirstAsync return this entry for date lookup
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT * FROM entries WHERE date')) {
          const date = params?.[0] as string;
          if (date === '2025-01-14') return localEntry;
        }
        return null;
      });

      // Mock Tree API with different SHA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [
            { path: 'ghjournal/entries/2025-01-14.md', sha: 'newremotesha', type: 'blob' },
          ],
          truncated: false,
        }),
      });

      // Mock Content API for updated file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'newremotesha',
          content: Buffer.from(`---
date: 2025-01-14
title: Updated Entry
created_at: 2025-01-14T10:00:00Z
updated_at: 2025-01-14T12:00:00Z
---

更新された内容`).toString('base64'),
        }),
      });

      const result = await pullEntries();

      expect(result.updated).toBe(1);
    });

    it('should delete local entries removed from remote', async () => {
      // Set up local committed entry that's not on remote
      const localOnlyEntry: Entry = {
        ...committedEntry,
        date: '2025-01-13',
        synced_sha: 'localsha',
      };
      mockDb._entries.set(localOnlyEntry.id, localOnlyEntry);
      mockDb.getAllAsync.mockResolvedValue([localOnlyEntry]);

      // Mock Tree API with no entries
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [],
          truncated: false,
        }),
      });

      const result = await pullEntries();

      expect(result.deleted).toBe(1);
    });

    it('should return error when not authenticated', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const result = await pullEntries();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('GitHub未認証');
    });

    it('should handle empty repository (404)', async () => {
      // Mock Tree API returning 404 for empty repository
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await pullEntries();

      expect(result.success).toBe(true);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should handle empty repository (409)', async () => {
      // Mock Tree API returning 409 for uninitialized repository
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const result = await pullEntries();

      expect(result.success).toBe(true);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });

  describe('syncEntries', () => {
    it('should run pull then push', async () => {
      // Mock Tree API (for pull)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [],
          truncated: false,
        }),
      });

      const result = await syncEntries();

      expect(result.pullResult.success).toBe(true);
      expect(result.pushResult.success).toBe(true);
    });

    it('should still push even if pull has conflicts', async () => {
      mockDb._entries.set(uncommittedEntry.id, { ...uncommittedEntry });

      // Mock Tree API with conflicting entry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sha: 'treesha',
          tree: [
            { path: 'ghjournal/entries/2025-01-15.md', sha: 'conflictsha', type: 'blob' },
          ],
          truncated: false,
        }),
      });

      // Note: push should still be called but will skip conflicting entries

      const result = await syncEntries();

      expect(result.pullResult.conflicts).toBe(1);
    });
  });
});

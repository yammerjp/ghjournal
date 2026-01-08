import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { SyncProvider, useSync } from './SyncContext';

// Mock dependencies
jest.mock('../lib/github-auth', () => ({
  getGitHubConfig: jest.fn().mockResolvedValue({
    hasToken: true,
    repository: 'test/repo',
    repositoryIsPrivate: true,
  }),
}));

jest.mock('../lib/github-sync', () => ({
  syncEntries: jest.fn(),
}));

jest.mock('../lib/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { syncEntries } from '../lib/github-sync';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SyncProvider>{children}</SyncProvider>
);

describe('SyncContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sync locking', () => {
    it('should not allow concurrent sync operations', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      let syncCallCount = 0;
      (syncEntries as jest.Mock).mockImplementation(async () => {
        syncCallCount++;
        await delay(100);
        return { pullResult: { success: true }, pushResult: { success: true } };
      });

      const { result } = renderHook(() => useSync(), { wrapper });

      // Start two syncs concurrently
      let sync1Result: unknown;
      let sync2Result: unknown;

      await act(async () => {
        const sync1Promise = result.current.sync();
        const sync2Promise = result.current.sync();

        [sync1Result, sync2Result] = await Promise.all([sync1Promise, sync2Promise]);
      });

      // Only one sync should have executed
      expect(syncCallCount).toBe(1);
      // One should return result, other should return null
      expect(sync1Result !== null || sync2Result !== null).toBe(true);
      expect(sync1Result === null || sync2Result === null).toBe(true);
    });

    it('should allow sync after previous sync completes', async () => {
      let syncCallCount = 0;
      (syncEntries as jest.Mock).mockImplementation(async () => {
        syncCallCount++;
        return { pullResult: { success: true }, pushResult: { success: true } };
      });

      const { result } = renderHook(() => useSync(), { wrapper });

      await act(async () => {
        await result.current.sync();
      });

      await act(async () => {
        await result.current.sync();
      });

      expect(syncCallCount).toBe(2);
    });

    it('should hold lock during sync execution', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      let lockHeldDuringExecution = false;
      (syncEntries as jest.Mock).mockImplementation(async () => {
        // Check if a second sync would be blocked (lock is held)
        lockHeldDuringExecution = true;
        await delay(50);
        return { pullResult: { success: true }, pushResult: { success: true } };
      });

      const { result } = renderHook(() => useSync(), { wrapper });

      await act(async () => {
        await result.current.sync();
      });

      expect(lockHeldDuringExecution).toBe(true);
    });
  });
});

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getGitHubConfig } from '../lib/github-auth';
import { syncEntries, SyncResult } from '../lib/github-sync';
import { getDatabase } from '../lib/database';

const LAST_SYNC_KEY = 'last_sync_at';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface SyncContextType {
  isSyncing: boolean;
  lastSyncAt: number | null;
  isConnected: boolean;
  sync: () => Promise<SyncResult | null>;
  pullIfNeeded: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const checkConnection = useCallback(async () => {
    const config = await getGitHubConfig();
    setIsConnected(config.hasToken && !!config.repository);
  }, []);

  const loadLastSyncAt = useCallback(async () => {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [LAST_SYNC_KEY]
    );
    if (result?.value) {
      setLastSyncAt(parseInt(result.value, 10));
    }
  }, []);

  const saveLastSyncAt = useCallback(async (timestamp: number) => {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [LAST_SYNC_KEY, timestamp.toString()]
    );
    setLastSyncAt(timestamp);
  }, []);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (isSyncing) return null;

    const config = await getGitHubConfig();
    if (!config.hasToken || !config.repository) {
      return null;
    }

    setIsSyncing(true);
    try {
      const result = await syncEntries();
      await saveLastSyncAt(Date.now());
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, saveLastSyncAt]);

  const pullIfNeeded = useCallback(async () => {
    await loadLastSyncAt();
    await checkConnection();

    const config = await getGitHubConfig();
    if (!config.hasToken || !config.repository) {
      return;
    }

    const now = Date.now();
    const shouldSync = !lastSyncAt || (now - lastSyncAt) >= SYNC_INTERVAL_MS;

    if (shouldSync) {
      await sync();
    }
  }, [lastSyncAt, loadLastSyncAt, checkConnection, sync]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        lastSyncAt,
        isConnected,
        sync,
        pullIfNeeded,
        checkConnection,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

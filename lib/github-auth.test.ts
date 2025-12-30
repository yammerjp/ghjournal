import {
  requestDeviceCode,
  pollForAccessToken,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  isConnected,
  getRepository,
  setRepository,
  clearRepository,
  getGitHubConfig,
  DeviceCodeResponse,
} from './github-auth';
import { setDatabase } from './database';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GitHub Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestDeviceCode', () => {
    it('should request device code from GitHub', async () => {
      const mockResponse: DeviceCodeResponse = {
        device_code: 'test-device-code',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await requestDeviceCode('test-client-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/device/code',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            scope: 'repo',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(requestDeviceCode('test-client-id')).rejects.toThrow();
    });
  });

  describe('pollForAccessToken', () => {
    it('should return access token on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'gho_test_token',
          token_type: 'bearer',
          scope: 'repo',
        }),
      });

      const result = await pollForAccessToken('test-client-id', 'test-device-code');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'test-device-code',
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        })
      );

      expect(result).toEqual({
        access_token: 'gho_test_token',
        token_type: 'bearer',
        scope: 'repo',
      });
    });

    it('should return pending status when authorization is pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending.',
        }),
      });

      const result = await pollForAccessToken('test-client-id', 'test-device-code');

      expect(result).toEqual({
        error: 'authorization_pending',
        error_description: 'The authorization request is still pending.',
      });
    });

    it('should return slow_down error when polling too fast', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'slow_down',
          error_description: 'You are polling too fast.',
          interval: 10,
        }),
      });

      const result = await pollForAccessToken('test-client-id', 'test-device-code');

      expect(result).toEqual({
        error: 'slow_down',
        error_description: 'You are polling too fast.',
        interval: 10,
      });
    });

    it('should return expired_token error when code expires', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'expired_token',
          error_description: 'The device code has expired.',
        }),
      });

      const result = await pollForAccessToken('test-client-id', 'test-device-code');

      expect(result).toEqual({
        error: 'expired_token',
        error_description: 'The device code has expired.',
      });
    });

    it('should return access_denied error when user denies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'access_denied',
          error_description: 'The user denied the request.',
        }),
      });

      const result = await pollForAccessToken('test-client-id', 'test-device-code');

      expect(result).toEqual({
        error: 'access_denied',
        error_description: 'The user denied the request.',
      });
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve token from secure store', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('gho_stored_token');

      const result = await getAccessToken();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('github_access_token');
      expect(result).toBe('gho_stored_token');
    });

    it('should return null if no token stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('setAccessToken', () => {
    it('should store token in secure store', async () => {
      await setAccessToken('gho_new_token');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'github_access_token',
        'gho_new_token'
      );
    });
  });

  describe('clearAccessToken', () => {
    it('should remove token from secure store', async () => {
      await clearAccessToken();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('github_access_token');
    });
  });

  describe('isConnected', () => {
    it('should return true if token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('gho_stored_token');

      const result = await isConnected();

      expect(result).toBe(true);
    });

    it('should return false if no token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await isConnected();

      expect(result).toBe(false);
    });
  });

  describe('repository configuration', () => {
    const createMockDb = () => {
      const settings: Map<string, string> = new Map();

      return {
        getFirstAsync: jest.fn(async (_sql: string, params?: unknown[]) => {
          const key = params?.[0] as string;
          const value = settings.get(key);
          return value ? { value } : null;
        }),
        runAsync: jest.fn(async (sql: string, params: unknown[]) => {
          if (sql.includes('INSERT OR REPLACE INTO settings')) {
            const key = params[0] as string;
            const value = params[1] as string;
            settings.set(key, value);
          } else if (sql.includes('DELETE FROM settings')) {
            const key = params[0] as string;
            settings.delete(key);
          }
          return { changes: 1 };
        }),
        getAllAsync: jest.fn(async () => []),
        execAsync: jest.fn(async () => {}),
        _settings: settings,
      };
    };

    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      setDatabase(mockDb as unknown as Parameters<typeof setDatabase>[0]);
    });

    describe('getRepository', () => {
      it('should return repository from settings', async () => {
        mockDb._settings.set('github_repository', 'owner/repo');

        const result = await getRepository();

        expect(result).toBe('owner/repo');
      });

      it('should return null if not configured', async () => {
        const result = await getRepository();

        expect(result).toBeNull();
      });
    });

    describe('setRepository', () => {
      it('should save repository to settings', async () => {
        await setRepository('owner/repo');

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['github_repository', 'owner/repo']
        );
      });

      it('should also save connected_at timestamp', async () => {
        await setRepository('owner/repo');

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['github_connected_at', expect.any(String)]
        );
      });
    });

    describe('clearRepository', () => {
      it('should remove repository from settings', async () => {
        await clearRepository();

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          'DELETE FROM settings WHERE key = ?',
          ['github_repository']
        );
      });

      it('should also remove connected_at', async () => {
        await clearRepository();

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          'DELETE FROM settings WHERE key = ?',
          ['github_connected_at']
        );
      });
    });

    describe('getGitHubConfig', () => {
      it('should return full config when connected', async () => {
        mockDb._settings.set('github_repository', 'owner/repo');
        mockDb._settings.set('github_connected_at', '2024-01-15T10:00:00Z');
        mockSecureStore.getItemAsync.mockResolvedValueOnce('gho_token');

        const result = await getGitHubConfig();

        expect(result).toEqual({
          repository: 'owner/repo',
          connectedAt: '2024-01-15T10:00:00Z',
          hasToken: true,
        });
      });

      it('should return null repository when not configured', async () => {
        mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

        const result = await getGitHubConfig();

        expect(result).toEqual({
          repository: null,
          connectedAt: null,
          hasToken: false,
        });
      });
    });
  });
});

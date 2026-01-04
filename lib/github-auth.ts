import * as SecureStore from 'expo-secure-store';
import { getDatabase } from './database';

const SECURE_STORE_KEY = 'github_access_token';
const SECURE_STORE_KEY_REFRESH_TOKEN = 'github_refresh_token';
const SECURE_STORE_KEY_TOKEN_EXPIRES_AT = 'github_token_expires_at';
const SETTINGS_KEY_REPOSITORY = 'github_repository';
const SETTINGS_KEY_REPOSITORY_IS_PRIVATE = 'github_repository_is_private';
const SETTINGS_KEY_CONNECTED_AT = 'github_connected_at';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;  // user_codeが埋め込まれたURL（あれば）
  expires_in: number;
  interval: number;
}

export interface AccessTokenSuccessResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  // GitHub App specific fields
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

export interface AccessTokenErrorResponse {
  error: 'authorization_pending' | 'slow_down' | 'expired_token' | 'access_denied' | string;
  error_description: string;
  interval?: number;
}

export type AccessTokenResponse = AccessTokenSuccessResponse | AccessTokenErrorResponse;

export function isAccessTokenSuccess(response: AccessTokenResponse): response is AccessTokenSuccessResponse {
  return 'access_token' in response;
}

export function isAccessTokenError(response: AccessTokenResponse): response is AccessTokenErrorResponse {
  return 'error' in response;
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      // GitHub Appではscopeは不要（fine-grained permissionsを使用）
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function pollForAccessToken(
  clientId: string,
  deviceCode: string
): Promise<AccessTokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to poll for access token: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Client ID（リフレッシュ時に必要）
const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";

export async function getAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (!token) return null;

  // 有効期限をチェック
  const expiresAtStr = await SecureStore.getItemAsync(SECURE_STORE_KEY_TOKEN_EXPIRES_AT);
  if (expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);
    const now = Date.now();
    // 期限切れの5分前にリフレッシュ
    if (now >= expiresAt - 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return SecureStore.getItemAsync(SECURE_STORE_KEY);
      }
      // リフレッシュ失敗時は現在のトークンを返す（まだ使える可能性がある）
    }
  }

  return token;
}

export async function setAccessToken(token: string, expiresIn?: number, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, token);

  if (expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(SECURE_STORE_KEY_TOKEN_EXPIRES_AT, expiresAt.toString());
  }

  if (refreshToken) {
    await SecureStore.setItemAsync(SECURE_STORE_KEY_REFRESH_TOKEN, refreshToken);
  }
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY_REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY_TOKEN_EXPIRES_AT);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEY_REFRESH_TOKEN);
  if (!refreshToken || !GITHUB_CLIENT_ID) {
    return false;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (isAccessTokenSuccess(data)) {
      await setAccessToken(data.access_token, data.expires_in, data.refresh_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function isConnected(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

// Repository configuration (stored in SQLite settings table)

export async function getRepository(): Promise<string | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY]
  );
  return result?.value ?? null;
}

export async function setRepository(repository: string, isPrivate?: boolean): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SETTINGS_KEY_REPOSITORY, repository]
  );

  if (isPrivate !== undefined) {
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [SETTINGS_KEY_REPOSITORY_IS_PRIVATE, isPrivate ? 'true' : 'false']
    );
  }

  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SETTINGS_KEY_CONNECTED_AT, now]
  );
}

export async function clearRepository(): Promise<void> {
  const database = await getDatabase();

  await database.runAsync(
    'DELETE FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY]
  );

  await database.runAsync(
    'DELETE FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY_IS_PRIVATE]
  );

  await database.runAsync(
    'DELETE FROM settings WHERE key = ?',
    [SETTINGS_KEY_CONNECTED_AT]
  );
}

export interface GitHubConfig {
  repository: string | null;
  repositoryIsPrivate: boolean | null;
  connectedAt: string | null;
  hasToken: boolean;
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  const database = await getDatabase();

  const repoResult = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY]
  );

  const isPrivateResult = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY_IS_PRIVATE]
  );

  const connectedAtResult = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_CONNECTED_AT]
  );

  const token = await getAccessToken();

  return {
    repository: repoResult?.value ?? null,
    repositoryIsPrivate: isPrivateResult?.value === 'true' ? true : isPrivateResult?.value === 'false' ? false : null,
    connectedAt: connectedAtResult?.value ?? null,
    hasToken: token !== null,
  };
}

// GitHub API: リポジトリ一覧取得

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
  };
}

interface InstallationResponse {
  id: number;
  account: {
    login: string;
  };
}

interface InstallationsResponse {
  total_count: number;
  installations: InstallationResponse[];
}

interface RepositoriesResponse {
  total_count: number;
  repositories: GitHubRepository[];
}

export async function fetchAccessibleRepositories(): Promise<GitHubRepository[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  // 1. インストール一覧を取得
  const installationsRes = await fetch('https://api.github.com/user/installations', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!installationsRes.ok) {
    throw new Error(`Failed to fetch installations: ${installationsRes.status}`);
  }

  const installationsData: InstallationsResponse = await installationsRes.json();

  // 2. 各インストールのリポジトリを取得
  const allRepositories: GitHubRepository[] = [];

  for (const installation of installationsData.installations) {
    const reposRes = await fetch(
      `https://api.github.com/user/installations/${installation.id}/repositories`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (reposRes.ok) {
      const reposData: RepositoriesResponse = await reposRes.json();
      allRepositories.push(...reposData.repositories);
    }
  }

  return allRepositories;
}

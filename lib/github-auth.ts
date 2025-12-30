import * as SecureStore from 'expo-secure-store';
import { getDatabase } from './database';

const SECURE_STORE_KEY = 'github_access_token';
const SETTINGS_KEY_REPOSITORY = 'github_repository';
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
  scope: string;
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
      scope: 'repo',
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

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
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

export async function setRepository(repository: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SETTINGS_KEY_REPOSITORY, repository]
  );

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
    [SETTINGS_KEY_CONNECTED_AT]
  );
}

export interface GitHubConfig {
  repository: string | null;
  connectedAt: string | null;
  hasToken: boolean;
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  const database = await getDatabase();

  const repoResult = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_REPOSITORY]
  );

  const connectedAtResult = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEY_CONNECTED_AT]
  );

  const token = await getAccessToken();

  return {
    repository: repoResult?.value ?? null,
    connectedAt: connectedAtResult?.value ?? null,
    hasToken: token !== null,
  };
}

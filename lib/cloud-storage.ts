import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CloudStorage, CloudStorageProvider } from 'react-native-cloud-storage';
import Constants from 'expo-constants';

const IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId as string | undefined;
const WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;

// Google Drive API scope for app-specific data folder
const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let isConfigured = false;

export function configureGoogleSignIn(): void {
  if (isConfigured) return;

  GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    scopes: [DRIVE_APPDATA_SCOPE],
    offlineAccess: true,
  });

  isConfigured = true;
}

export async function signInToGoogle(): Promise<string | null> {
  try {
    configureGoogleSignIn();

    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    // Get access token
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;

    if (accessToken) {
      // Set the token for cloud storage
      CloudStorage.setProviderOptions({
        accessToken,
      });
    }

    return accessToken;
  } catch (error) {
    console.error('Google Sign-In error:', error);
    return null;
  }
}

export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Google Sign-Out error:', error);
  }
}

export function isSignedIn(): boolean {
  try {
    return GoogleSignin.hasPreviousSignIn();
  } catch {
    return false;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;

    if (accessToken) {
      CloudStorage.setProviderOptions({
        accessToken,
      });
    }

    return accessToken;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

export function getCloudStorageProvider(): CloudStorageProvider {
  return CloudStorage.getProvider();
}

export { CloudStorage };

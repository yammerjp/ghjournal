import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { debugLog } from './debug-log';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

// Get current access token
async function getAccessToken(): Promise<string> {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

// List files in appDataFolder
export async function listAppDataFiles(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `${DRIVE_API_BASE}/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    const data = await response.json();
    debugLog.info(`Listed ${data.files?.length ?? 0} files in appDataFolder`);
    return data.files ?? [];
  } catch (error) {
    debugLog.error('Failed to list appDataFolder files', String(error));
    throw error;
  }
}

// Upload a file to appDataFolder
export async function uploadToAppData(
  localPath: string,
  fileName: string
): Promise<string> {
  try {
    const accessToken = await getAccessToken();

    // Read the local file as base64
    const fileContent = await readAsStringAsync(localPath, {
      encoding: EncodingType.Base64,
    });

    // Check if file already exists
    const existingFiles = await listAppDataFiles();
    const existingFile = existingFiles.find(f => f.name === fileName);

    if (existingFile) {
      // Update existing file
      debugLog.info(`Updating existing file: ${fileName}`);

      const response = await fetch(
        `${DRIVE_UPLOAD_BASE}/files/${existingFile.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Content-Transfer-Encoding': 'base64',
          },
          body: fileContent,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update file: ${error}`);
      }

      debugLog.info(`Updated file: ${fileName}`);
      return existingFile.id;
    } else {
      // Create new file with multipart upload
      debugLog.info(`Creating new file: ${fileName}`);

      const metadata = {
        name: fileName,
        parents: ['appDataFolder'],
      };

      const boundary = 'foo_bar_baz';
      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/octet-stream\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        fileContent +
        `\r\n--${boundary}--`;

      const response = await fetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create file: ${error}`);
      }

      const result = await response.json();
      debugLog.info(`Created file: ${fileName} with id: ${result.id}`);
      return result.id;
    }
  } catch (error) {
    debugLog.error(`Failed to upload ${fileName}`, String(error));
    throw error;
  }
}

// Download a file from appDataFolder
export async function downloadFromAppData(
  fileId: string,
  localPath: string
): Promise<void> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    // Get response as blob and convert to base64
    const blob = await response.blob();
    const reader = new FileReader();

    await new Promise<void>((resolve, reject) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/octet-stream;base64,")
        const base64Content = base64data.split(',')[1] ?? base64data;

        writeAsStringAsync(localPath, base64Content, {
          encoding: EncodingType.Base64,
        })
          .then(() => resolve())
          .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    debugLog.info(`Downloaded file to: ${localPath}`);
  } catch (error) {
    debugLog.error(`Failed to download file ${fileId}`, String(error));
    throw error;
  }
}

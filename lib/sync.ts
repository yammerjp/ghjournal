import {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  copyAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import { getStreamId, importStreamToLocal } from './database';
import { commitAllSealedDrafts } from './diary';
import { debugLog } from './debug-log';
import { listAppDataFiles, uploadToAppData, downloadFromAppData } from './google-drive';

// Prefix for stream files in Google Drive AppData
const STREAM_FILE_PREFIX = 'stream_';

interface SyncResult {
  uploaded: boolean;
  downloaded: number;
  imported: number;
}

// Get the local path to my_stream.sqlite3
function getStreamDbPath(): string {
  return `${documentDirectory}SQLite/my_stream.sqlite3`;
}

// Upload my_stream.sqlite3 to cloud
async function uploadMyStream(): Promise<boolean> {
  try {
    const streamId = await getStreamId();
    const localPath = getStreamDbPath();
    const fileName = `${STREAM_FILE_PREFIX}${streamId}.sqlite3`;

    debugLog.info(`Uploading stream: local=${localPath}, fileName=${fileName}`);

    // Check if local file exists
    const fileInfo = await getInfoAsync(localPath);
    if (!fileInfo.exists) {
      debugLog.warn('Stream database does not exist locally');
      return false;
    }

    // Upload using Google Drive API directly
    await uploadToAppData(localPath, fileName);

    debugLog.info(`Uploaded stream: ${streamId}`);
    return true;
  } catch (error) {
    debugLog.error('Failed to upload stream', String(error));
    throw error;
  }
}

// List all streams on cloud
async function listCloudStreams(): Promise<Array<{ id: string; name: string }>> {
  try {
    const files = await listAppDataFiles();
    debugLog.info(`Found ${files.length} files in AppData`);

    // Filter for stream files
    const streams = files.filter(f =>
      f.name.startsWith(STREAM_FILE_PREFIX) && f.name.endsWith('.sqlite3')
    );
    debugLog.info(`Found ${streams.length} stream files`);
    return streams;
  } catch (error) {
    debugLog.error('Failed to list cloud streams', String(error));
    return [];
  }
}

// Download and import a stream from cloud
async function downloadAndImportStream(fileId: string, fileName: string): Promise<number> {
  try {
    const localCachePath = `${cacheDirectory}${fileName}`;
    debugLog.info(`Downloading stream: ${fileName}`);

    // Download using Google Drive API
    await downloadFromAppData(fileId, localCachePath);

    debugLog.info(`Downloaded stream: ${fileName}`);

    // Copy to SQLite directory and open
    const SQLite = await import('expo-sqlite');
    const tempDbName = `temp_${fileName}`;
    const tempDbPath = `${documentDirectory}SQLite/${tempDbName}`;

    // Copy downloaded file to SQLite directory
    await copyAsync({
      from: localCachePath,
      to: tempDbPath,
    });

    // Open the temporary database
    const tempDb = await SQLite.openDatabaseAsync(tempDbName);

    // Import to local
    const result = await importStreamToLocal(tempDb);

    // Close and delete temporary database
    await tempDb.closeAsync();
    await deleteAsync(tempDbPath, { idempotent: true });

    // Clean up cache
    await deleteAsync(localCachePath, { idempotent: true });

    debugLog.info(`Imported ${result.imported} versions from ${fileName}`);
    return result.imported;
  } catch (error) {
    debugLog.error(`Failed to download/import stream: ${fileName}`, String(error));
    return 0;
  }
}

// Main sync function
export async function syncWithCloud(): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: false,
    downloaded: 0,
    imported: 0,
  };

  try {
    debugLog.info('Starting sync...');

    // Step 1: Commit any sealed drafts first
    const commitResult = await commitAllSealedDrafts();
    if (commitResult.committed > 0) {
      debugLog.info(`Committed ${commitResult.committed} sealed drafts`);
    }

    // Step 2: Upload my stream
    result.uploaded = await uploadMyStream();

    // Step 3: Get list of streams on cloud
    const cloudStreams = await listCloudStreams();
    const myStreamId = await getStreamId();

    // Step 4: Download and import other streams
    const myStreamFilename = `${STREAM_FILE_PREFIX}${myStreamId}.sqlite3`;
    for (const stream of cloudStreams) {
      // Skip my own stream
      if (stream.name === myStreamFilename) {
        debugLog.info(`Skipping my own stream: ${stream.name}`);
        continue;
      }

      result.downloaded++;
      const imported = await downloadAndImportStream(stream.id, stream.name);
      result.imported += imported;
    }

    debugLog.info(`Sync completed: uploaded=${result.uploaded}, downloaded=${result.downloaded}, imported=${result.imported}`);
    return result;
  } catch (error) {
    debugLog.error('Sync failed', String(error));
    throw error;
  }
}

import * as Crypto from 'expo-crypto';
import { getAccessToken, getRepository } from './github-auth';
import { getDatabase } from './database';
import { Entry, saveEntryRaw, getEntryByDate, deleteEntryLocal, isPendingDeletion, getPendingDeletions, removePendingDeletion } from './entry';
import { entryToMarkdown, markdownToEntry } from './entry-format';

const GITHUB_API_BASE = 'https://api.github.com';
const ENTRIES_PATH = 'ghjournal/entries';

export interface PushResult {
  success: boolean;
  pushed: number;
  deleted: number;
  errors: string[];
}

export interface PullResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  conflictDates: string[];
  errors: string[];
}

export interface SyncResult {
  pullResult: PullResult;
  pushResult: PushResult;
}

interface TreeItem {
  path: string;
  sha: string;
  type: 'blob' | 'tree';
}

interface TreeResponse {
  sha: string;
  tree: TreeItem[];
  truncated: boolean;
}

interface ContentResponse {
  sha: string;
  content: string;  // base64 encoded
}

/**
 * Push uncommitted local entries to GitHub and delete pending deletions
 */
export async function pushEntries(): Promise<PushResult> {
  const result: PushResult = { success: true, pushed: 0, deleted: 0, errors: [] };

  const token = await getAccessToken();
  if (!token) {
    result.success = false;
    result.errors.push('GitHub未認証');
    return result;
  }

  const repository = await getRepository();
  if (!repository) {
    result.success = false;
    result.errors.push('リポジトリ未設定');
    return result;
  }

  const database = await getDatabase();
  const uncommittedEntries = await database.getAllAsync<Entry>(
    "SELECT * FROM entries WHERE sync_status = 'uncommitted'"
  );

  for (const entry of uncommittedEntries) {
    try {
      const markdown = entryToMarkdown(entry);
      const content = btoa(unescape(encodeURIComponent(markdown)));  // UTF-8 to base64
      const path = `${ENTRIES_PATH}/${entry.date}.md`;

      // First, check if file exists and get current sha if needed
      let currentSha = entry.synced_sha;
      if (!currentSha) {
        // Check if file already exists on remote (might have been created by another device)
        const checkResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${repository}/contents/${path}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );
        if (checkResponse.ok) {
          const existingFile = await checkResponse.json();
          currentSha = existingFile.sha;
        }
        // 404 means file doesn't exist, which is fine for new files
      }

      const body: Record<string, string> = {
        message: `Update ${entry.date}`,
        content,
      };

      // Include sha if updating existing file
      if (currentSha) {
        body.sha = currentSha;
      }

      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repository}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify(body),
        }
      );

      if (response.status === 409) {
        // Conflict - file was modified by another device, skip for now
        result.errors.push(`${entry.date}: 衝突が発生しました。次回の同期で解決してください。`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to push ${entry.date}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const newSha = data.content.sha;

      // Update local entry with new sha and committed status
      await database.runAsync(
        `UPDATE entries SET sync_status = 'committed', synced_sha = ? WHERE id = ?`,
        [newSha, entry.id]
      );

      result.pushed++;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Process pending deletions (entries deleted locally or with date changed)
  const pendingDeletions = await getPendingDeletions();
  for (const deletion of pendingDeletions) {
    try {
      const path = `${ENTRIES_PATH}/${deletion.date}.md`;

      // Get current sha from remote (might have changed)
      const checkResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${repository}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (checkResponse.status === 404) {
        // File already deleted on remote, just remove from pending
        await removePendingDeletion(deletion.date);
        continue;
      }

      if (!checkResponse.ok) {
        throw new Error(`Failed to check ${deletion.date}: ${checkResponse.status}`);
      }

      const existingFile = await checkResponse.json();

      // Delete the file from GitHub
      const deleteResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${repository}/contents/${path}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            message: `Delete ${deletion.date}`,
            sha: existingFile.sha,
          }),
        }
      );

      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete ${deletion.date}: ${deleteResponse.status}`);
      }

      // Remove from pending deletions
      await removePendingDeletion(deletion.date);
      result.deleted++;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}

/**
 * Pull entries from GitHub to local
 */
export async function pullEntries(): Promise<PullResult> {
  const result: PullResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    conflicts: 0,
    conflictDates: [],
    errors: [],
  };

  const token = await getAccessToken();
  if (!token) {
    result.success = false;
    result.errors.push('GitHub未認証');
    return result;
  }

  const repository = await getRepository();
  if (!repository) {
    result.success = false;
    result.errors.push('リポジトリ未設定');
    return result;
  }

  try {
    // Get tree of all files
    const treeResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${repository}/git/trees/main?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    // Handle empty repository (no commits yet) - returns 404 or 409
    let treeData: TreeResponse;
    if (treeResponse.status === 404 || treeResponse.status === 409) {
      // Empty repository - treat as no remote entries
      treeData = { sha: '', tree: [], truncated: false };
    } else if (!treeResponse.ok) {
      throw new Error(`Failed to get tree: ${treeResponse.status}`);
    } else {
      treeData = await treeResponse.json();
    }

    // Filter to entry files
    const entryFiles = treeData.tree.filter(
      item => item.type === 'blob' && item.path.startsWith(`${ENTRIES_PATH}/`) && item.path.endsWith('.md')
    );

    const database = await getDatabase();
    const remoteDates = new Set<string>();

    // Process each remote entry
    for (const file of entryFiles) {
      const dateMatch = file.path.match(/(\d{4}-\d{2}-\d{2})\.md$/);
      if (!dateMatch) continue;

      const date = dateMatch[1];
      remoteDates.add(date);

      // Skip if this date is pending deletion (deleted locally or date was changed)
      if (await isPendingDeletion(date)) {
        continue;
      }

      const localEntry = await getEntryByDate(date);

      if (localEntry) {
        // Entry exists locally
        if (localEntry.synced_sha === file.sha) {
          // No change
          continue;
        }

        if (localEntry.sync_status === 'uncommitted') {
          // Conflict: local has uncommitted changes and remote changed
          result.conflicts++;
          result.conflictDates.push(date);
          continue;
        }

        // Update local with remote (committed entry, remote changed)
        const content = await fetchFileContent(token, repository, file.path);
        const remoteEntry = markdownToEntry(content, localEntry.id);

        await saveEntryRaw({
          ...remoteEntry,
          id: localEntry.id,
          sync_status: 'committed',
          synced_sha: file.sha,
        });

        result.updated++;
      } else {
        // New entry from remote
        const content = await fetchFileContent(token, repository, file.path);
        const newEntry = markdownToEntry(content, Crypto.randomUUID());

        await saveEntryRaw({
          ...newEntry,
          sync_status: 'committed',
          synced_sha: file.sha,
        });

        result.created++;
      }
    }

    // Check for entries deleted on remote
    const localEntries = await database.getAllAsync<Entry>('SELECT * FROM entries');
    for (const entry of localEntries) {
      if (!remoteDates.has(entry.date)) {
        if (entry.sync_status === 'committed' && entry.synced_sha) {
          // Entry was synced but no longer on remote - delete locally
          // Use deleteEntryLocal to avoid adding to pending_deletions (already deleted on remote)
          await deleteEntryLocal(entry.id);
          result.deleted++;
        }
        // If uncommitted, keep local (new entry not yet pushed)
      }
    }

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(token: string, repository: string, path: string): Promise<string> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repository}/contents/${path}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  const data: ContentResponse = await response.json();
  // Decode base64 content
  return decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
}

/**
 * Sync entries: pull then push
 */
export async function syncEntries(): Promise<SyncResult> {
  const pullResult = await pullEntries();
  const pushResult = await pushEntries();

  return { pullResult, pushResult };
}

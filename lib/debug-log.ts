import { getDatabase } from './database';

const MAX_LOGS = 100;

export interface DebugLogEntry {
  id?: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: string | null;
}

export async function addLog(
  level: DebugLogEntry['level'],
  message: string,
  details?: string
): Promise<void> {
  try {
    const database = await getDatabase();
    const timestamp = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO debug_logs (timestamp, level, message, details) VALUES (?, ?, ?, ?)',
      [timestamp, level, message, details ?? null]
    );

    // Keep only the last MAX_LOGS entries
    await database.runAsync(
      `DELETE FROM debug_logs WHERE id NOT IN (SELECT id FROM debug_logs ORDER BY id DESC LIMIT ?)`,
      [MAX_LOGS]
    );
  } catch (error) {
    // Silently fail to avoid infinite loop if logging itself fails
    console.error('Failed to write debug log:', error);
  }
}

export async function getDebugLogs(): Promise<DebugLogEntry[]> {
  try {
    const database = await getDatabase();
    const logs = await database.getAllAsync<DebugLogEntry>(
      'SELECT * FROM debug_logs ORDER BY id DESC LIMIT ?',
      [MAX_LOGS]
    );
    return logs;
  } catch (error) {
    console.error('Failed to read debug logs:', error);
    return [];
  }
}

export async function clearDebugLogs(): Promise<void> {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM debug_logs');
  } catch (error) {
    console.error('Failed to clear debug logs:', error);
  }
}

// Convenience functions
export const debugLog = {
  info: (message: string, details?: string) => addLog('info', message, details),
  warn: (message: string, details?: string) => addLog('warn', message, details),
  error: (message: string, details?: string) => addLog('error', message, details),
};

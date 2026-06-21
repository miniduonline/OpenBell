import log from 'electron-log';
import { getDb } from '../database/db';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 'system' | 'bell' | 'schedule' | 'backup' | 'auth';

log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB rotation

/**
 * Writes a log entry both to the rotating file log (electron-log) and
 * to the `logs` table in SQLite so it is queryable from the Reports page.
 */
export function writeLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  meta?: Record<string, unknown>,
  scheduleId?: number
): void {
  try {
    log[level](`[${category}] ${message}`, meta ?? '');
  } catch {
    // electron-log should not be able to throw, but guard anyway
  }

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO logs (level, category, message, meta, schedule_id) VALUES (?, ?, ?, ?, ?)`
    ).run(level, category, message, meta ? JSON.stringify(meta) : null, scheduleId ?? null);
  } catch (err) {
    log.error('Failed to persist log entry', err);
  }
}

export default { writeLog };

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDb, getDbPath } from '../database/db';
import { writeLog } from './logger';

function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Creates a copy of the live SQLite database file and records the
 * resulting metadata in the `backups` table.
 */
export function createBackup(type: 'manual' | 'automatic' = 'manual'): string {
  const dbPath = getDbPath();
  const backupDir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `openbell-backup-${timestamp}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    const size = fs.statSync(backupPath).size;

    const db = getDb();
    db.prepare(
      `INSERT INTO backups (file_path, size_bytes, type, status) VALUES (?, ?, ?, 'success')`
    ).run(backupPath, size, type);

    writeLog('info', 'backup', `Backup created (${type})`, { backupPath });
    return backupPath;
  } catch (err) {
    writeLog('error', 'backup', 'Backup failed', { error: String(err) });
    throw err;
  }
}

/**
 * Restores the database from a chosen backup file. The current
 * database is first safety-copied so a failed restore can be undone.
 */
export function restoreBackup(backupPath: string): void {
  const dbPath = getDbPath();
  const safetyCopy = `${dbPath}.before-restore`;

  try {
    fs.copyFileSync(dbPath, safetyCopy);
    fs.copyFileSync(backupPath, dbPath);
    writeLog('info', 'backup', 'Database restored from backup', { backupPath });
  } catch (err) {
    writeLog('error', 'backup', 'Restore failed', { error: String(err) });
    throw err;
  }
}

/** Schedules automatic backups every N days based on app settings. */
export function scheduleAutoBackup(intervalDays = 7): void {
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  setInterval(() => {
    try {
      createBackup('automatic');
    } catch {
      /* error already logged inside createBackup */
    }
  }, intervalMs);
}

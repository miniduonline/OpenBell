import { BrowserWindow } from 'electron';
import { getDb } from '../database/db';

interface SoundRow {
  id: number;
  file_path: string;
  volume: number;
}

/**
 * Sends a play command to the renderer process, which performs the
 * actual audio playback via the HTML5 Audio API (main process has no
 * audio output context of its own).
 */
export function playSound(soundId: number | null): void {
  if (!soundId) return;

  const db = getDb();
  const sound = db.prepare(`SELECT id, file_path, volume FROM sounds WHERE id = ?`).get(soundId) as
    | SoundRow
    | undefined;

  if (!sound) return;

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('bell:play', { filePath: sound.file_path, volume: sound.volume });
  }
}

/** Sends a one-off preview play request (used by the Sounds management page). */
export function previewSound(filePath: string, volume: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('bell:play', { filePath, volume });
  }
}

// ============================================================
// Bell Health Monitor
// ------------------------------------------------------------
// Solves the single most dangerous bug class in any bell system:
// a bell that was *supposed* to ring, silently doesn't, and nobody
// finds out until a teacher complains hours later.
//
// How it works:
//  1. When the scheduler decides a bell should ring, it calls
//     ringBellWithConfirmation() here instead of playing audio directly.
//  2. We dispatch the play command to the renderer (where actual HTML5
//     Audio playback happens) tagged with a unique requestId, and start
//     a timeout.
//  3. The renderer plays the sound and reports back success/failure via
//     confirmBellPlayResult(). If that confirmation never arrives within
//     the timeout (audio engine crashed, no window, speaker error, file
//     missing, etc.) we treat it as a FAILURE automatically.
//  4. Every outcome (success or failure) is written to the `logs` table
//     with rich detail, which is what powers the Reports page's
//     Activity Log and the Dashboard's Bell Health indicator.
//  5. On failure, we raise a native OS notification immediately - this
//     works with zero internet/network, on the same PC where it happened.
//
// Everything here is 100% offline. No email/SMS/cloud involved.
// ============================================================

import { BrowserWindow, Notification } from 'electron';
import { randomUUID } from 'crypto';
import { getDb } from '../database/db';
import { writeLog } from './logger';

const CONFIRMATION_TIMEOUT_MS = 12_000;

interface PendingRing {
  scheduleId: number;
  title: string;
  ringTime: string;
  soundId: number | null;
  dispatchedAt: number;
  timeout: NodeJS.Timeout;
}

const pending = new Map<string, PendingRing>();

interface SoundRow {
  id: number;
  file_path: string;
  volume: number;
  name: string;
}

function getSound(soundId: number | null): SoundRow | undefined {
  if (!soundId) return undefined;
  const db = getDb();
  return db.prepare(`SELECT id, file_path, volume, name FROM sounds WHERE id = ?`).get(soundId) as
    | SoundRow
    | undefined;
}

function raiseFailureNotification(title: string, ringTime: string, reason: string): void {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: '⚠️ OpenBell - Bell Failed to Ring',
        body: `"${title}" at ${ringTime} did not play. Reason: ${reason}`,
        urgency: 'critical',
      }).show();
    }
  } catch {
    // Notifications are best-effort - never let this crash the scheduler.
  }

  // Also push a banner into any open OpenBell windows so it's impossible
  // to miss even if the OS notification gets dismissed/missed.
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('bell:healthAlert', { title, ringTime, reason, at: new Date().toISOString() });
  }
}

function recordOutcome(
  requestId: string,
  success: boolean,
  reason: string | null,
  latencyMs: number | null
): void {
  const entry = pending.get(requestId);
  if (!entry) return; // Already resolved (or unknown request) - ignore duplicate/late confirmations.

  clearTimeout(entry.timeout);
  pending.delete(requestId);

  const sound = getSound(entry.soundId);

  if (success) {
    writeLog(
      'info',
      'bell',
      `Bell rang: ${entry.title}`,
      {
        ringTime: entry.ringTime,
        soundName: sound?.name ?? null,
        latencyMs,
        confirmed: true,
      },
      entry.scheduleId
    );
  } else {
    const failureReason = reason ?? 'No confirmation received from the audio engine (timed out)';
    writeLog(
      'error',
      'bell',
      `BELL FAILED TO RING: ${entry.title}`,
      {
        ringTime: entry.ringTime,
        soundName: sound?.name ?? null,
        reason: failureReason,
        confirmed: false,
      },
      entry.scheduleId
    );
    raiseFailureNotification(entry.title, entry.ringTime, failureReason);
  }
}

/**
 * Called by the scheduler for every bell that should ring right now.
 * Dispatches playback to the renderer and tracks whether it actually
 * gets confirmed within CONFIRMATION_TIMEOUT_MS.
 */
export function ringBellWithConfirmation(schedule: {
  id: number;
  title: string;
  ring_time: string;
  sound_id: number | null;
}): void {
  const windows = BrowserWindow.getAllWindows();

  // No window at all means there is no renderer/audio engine to play
  // anything - this is an instant, certain failure, no need to wait.
  if (windows.length === 0) {
    writeLog(
      'error',
      'bell',
      `BELL FAILED TO RING: ${schedule.title}`,
      { ringTime: schedule.ring_time, reason: 'No application window available to play audio', confirmed: false },
      schedule.id
    );
    raiseFailureNotification(schedule.title, schedule.ring_time, 'No application window available to play audio');
    return;
  }

  const sound = getSound(schedule.sound_id);
  if (!sound) {
    // A schedule with no (or a deleted) sound assigned is also a
    // failure worth surfacing - someone expected this bell to make noise.
    writeLog(
      'error',
      'bell',
      `BELL FAILED TO RING: ${schedule.title}`,
      { ringTime: schedule.ring_time, reason: 'No sound file is assigned to this schedule', confirmed: false },
      schedule.id
    );
    raiseFailureNotification(schedule.title, schedule.ring_time, 'No sound file is assigned to this schedule');
    return;
  }

  const requestId = randomUUID();
  const dispatchedAt = Date.now();

  const timeout = setTimeout(() => {
    recordOutcome(requestId, false, null, null);
  }, CONFIRMATION_TIMEOUT_MS);

  pending.set(requestId, {
    scheduleId: schedule.id,
    title: schedule.title,
    ringTime: schedule.ring_time,
    soundId: schedule.sound_id,
    dispatchedAt,
    timeout,
  });

  for (const win of windows) {
    win.webContents.send('bell:play', {
      requestId,
      filePath: sound.file_path,
      volume: sound.volume,
    });
  }
}

/** Called via IPC when the renderer's <audio> element finishes (or errors). */
export function confirmBellPlayResult(requestId: string, success: boolean, errorMessage?: string): void {
  const entry = pending.get(requestId);
  if (!entry) return;
  const latencyMs = Date.now() - entry.dispatchedAt;
  recordOutcome(requestId, success, errorMessage ?? null, latencyMs);
}

/**
 * Returns a quick health summary for the Dashboard "Bell Health" card -
 * how many bells failed in the last 24 hours, and the most recent one.
 */
export function getBellHealthSummary(): {
  failuresLast24h: number;
  lastFailure: { title: string; ringTime: string; reason: string; at: string } | null;
} {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  const failures = db
    .prepare(
      `SELECT message, meta, created_at FROM logs
       WHERE category = 'bell' AND level = 'error' AND created_at >= ?
       ORDER BY created_at DESC`
    )
    .all(since) as { message: string; meta: string | null; created_at: string }[];

  let lastFailure = null;
  if (failures.length > 0) {
    const f = failures[0];
    let meta: any = {};
    try {
      meta = f.meta ? JSON.parse(f.meta) : {};
    } catch {
      /* ignore */
    }
    lastFailure = {
      title: f.message.replace('BELL FAILED TO RING: ', ''),
      ringTime: meta.ringTime ?? '',
      reason: meta.reason ?? 'Unknown',
      at: f.created_at,
    };
  }

  return { failuresLast24h: failures.length, lastFailure };
}

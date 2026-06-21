// ============================================================
// LAN Sync Service
// ------------------------------------------------------------
// Lets one PC ("Host" - usually the school office computer where
// schedules are actually edited) share its bell schedules + holidays
// with other PCs on the same local network ("Clients" - e.g. a lab or
// hall computer that should ring the same bells).
//
// This is intentionally NOT internet/cloud based - everything happens
// over the local network (same Wi-Fi/LAN), so it keeps working even
// if the school's internet connection is down or there isn't one at all.
//
// Scope (kept deliberately simple for v1):
//  - One-way sync: Host is always the source of truth. Clients pull and
//    overwrite their local schedules/holidays with whatever the Host has.
//  - Sound *files* are NOT transferred over the network (that would need
//    a much bigger file-transfer protocol). Only sound *names* travel
//    with each schedule; each Client resolves the sound by matching name
//    against its own locally-uploaded sounds. If a Client doesn't have a
//    sound with that name yet, the bell will simply use the default/no
//    sound until someone uploads a same-named sound file on that PC too.
// ============================================================

import http from 'http';
import os from 'os';
import { getDb } from '../database/db';
import { writeLog } from './logger';

const SYNC_PATH = '/openbell-sync/export';
const PING_PATH = '/openbell-sync/ping';

let server: http.Server | null = null;
let clientPollTimer: NodeJS.Timeout | null = null;

export interface SyncExportPayload {
  schoolName: string;
  exportedAt: string;
  schedules: Array<{
    title: string;
    day_of_week: number;
    ring_time: string;
    sound_name: string | null;
    category: string;
    is_active: number;
    repeat_weekly: number;
    sort_order: number;
    notes: string | null;
  }>;
  holidays: Array<{
    title: string;
    date: string;
    end_date: string | null;
    type: string;
    description: string | null;
  }>;
}

// ---- Helpers ----------------------------------------------------------------

/** Returns this machine's local-network IPv4 address (e.g. 192.168.1.42),
 *  or null if it can't find one (e.g. no network adapter connected). */
export function getLocalIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function buildExportPayload(): SyncExportPayload {
  const db = getDb();
  const schoolNameRow = db
    .prepare(`SELECT value FROM settings WHERE key = 'school_name'`)
    .get() as { value?: string } | undefined;

  const schedules = db
    .prepare(
      `SELECT s.title, s.day_of_week, s.ring_time, snd.name as sound_name,
              s.category, s.is_active, s.repeat_weekly, s.sort_order, s.notes
       FROM schedules s
       LEFT JOIN sounds snd ON snd.id = s.sound_id`
    )
    .all() as SyncExportPayload['schedules'];

  const holidays = db
    .prepare(`SELECT title, date, end_date, type, description FROM holidays`)
    .all() as SyncExportPayload['holidays'];

  return {
    schoolName: schoolNameRow?.value ?? 'My School',
    exportedAt: new Date().toISOString(),
    schedules,
    holidays,
  };
}

// ---- Host mode ----------------------------------------------------------------

export function startSyncServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve();
      return;
    }
    server = http.createServer((req, res) => {
      // Allow other PCs (different origin/port) to fetch this in case
      // anyone ever calls it from a browser context too.
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.url === PING_PATH) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, app: 'OpenBell' }));
        return;
      }

      if (req.url === SYNC_PATH) {
        try {
          const payload = buildExportPayload();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.on('error', (err) => {
      server = null;
      reject(err);
    });

    server.listen(port, () => {
      writeLog('info', 'system', `LAN sync host server started on port ${port}`);
      resolve();
    });
  });
}

export function stopSyncServer(): void {
  if (server) {
    server.close();
    server = null;
    writeLog('info', 'system', 'LAN sync host server stopped');
  }
}

export function isSyncServerRunning(): boolean {
  return server !== null;
}

// ---- Client mode ----------------------------------------------------------------

function fetchJson(hostIp: string, port: number, urlPath: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: hostIp, port, path: urlPath, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Host responded with status ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection to host timed out'));
    });
  });
}

/** Quick reachability check, used by the "Test Connection" button in Settings. */
export async function pingHost(hostIp: string, port: number): Promise<boolean> {
  try {
    const result = await fetchJson(hostIp, port, PING_PATH, 3000);
    return result?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Pulls the Host's schedules + holidays and replaces this PC's local copies.
 * Host is always the source of truth - this is a one-way mirror, not a merge.
 * Sound files themselves are not transferred; sounds are matched by name
 * against whatever this PC already has uploaded locally (see file header).
 */
export async function syncNow(hostIp: string, port: number): Promise<{ schedules: number; holidays: number }> {
  const payload: SyncExportPayload = await fetchJson(hostIp, port, SYNC_PATH, 8000);
  const db = getDb();

  const applyAll = db.transaction(() => {
    // Build a name -> id lookup for sounds already on this PC.
    const soundRows = db.prepare('SELECT id, name FROM sounds').all() as { id: number; name: string }[];
    const soundIdByName = new Map(soundRows.map((s) => [s.name, s.id]));

    db.prepare('DELETE FROM schedules').run();
    const insertSchedule = db.prepare(`
      INSERT INTO schedules
        (title, day_of_week, ring_time, sound_id, category, is_active, repeat_weekly, sort_order, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of payload.schedules) {
      const soundId = s.sound_name ? soundIdByName.get(s.sound_name) ?? null : null;
      insertSchedule.run(
        s.title,
        s.day_of_week,
        s.ring_time,
        soundId,
        s.category,
        s.is_active,
        s.repeat_weekly,
        s.sort_order,
        s.notes
      );
    }

    db.prepare('DELETE FROM holidays').run();
    const insertHoliday = db.prepare(`
      INSERT INTO holidays (title, date, end_date, type, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const h of payload.holidays) {
      insertHoliday.run(h.title, h.date, h.end_date, h.type, h.description);
    }

    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('lan_sync_last_synced', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(new Date().toISOString());
  });

  applyAll();

  writeLog('info', 'system', `LAN sync pulled from host ${hostIp}:${port}`, {
    schedules: payload.schedules.length,
    holidays: payload.holidays.length,
  });

  return { schedules: payload.schedules.length, holidays: payload.holidays.length };
}

/** Starts a background timer that calls syncNow() every `intervalMinutes`. */
export function startClientAutoSync(hostIp: string, port: number, intervalMinutes: number): void {
  stopClientAutoSync();
  clientPollTimer = setInterval(() => {
    syncNow(hostIp, port).catch((err) => {
      writeLog('warn', 'system', `LAN sync auto-pull failed: ${String(err)}`);
    });
  }, Math.max(1, intervalMinutes) * 60_000);
}

export function stopClientAutoSync(): void {
  if (clientPollTimer) {
    clearInterval(clientPollTimer);
    clientPollTimer = null;
  }
}

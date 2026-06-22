// ============================================================
// Remote Viewer Service
// ------------------------------------------------------------
// Serves a tiny read-only web page (no login, no editing) that shows
// "what's the next bell, and when" - so anyone on the same Wi-Fi/network
// can open it on their phone/tablet browser by typing this PC's address.
//
// This is completely separate from LAN Sync (multi-PC schedule sharing):
// - LAN Sync copies schedule DATA between PCs.
// - Remote Viewer just shows a live read-out of whatever THIS PC's own
//   schedule already says, in a phone-friendly web page.
// Both can be on at the same time, or used independently.
//
// No internet required - this page is only reachable by devices on the
// same local network as this PC, the same as any home router page.
// ============================================================

import http from 'http';
import { getDb } from '../database/db';
import { writeLog } from './logger';

let server: http.Server | null = null;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

interface BellRow {
  id: number;
  title: string;
  day_of_week: number;
  ring_time: string;
  category: string;
}

function nextOccurrenceMs(dayOfWeek: number, ringTime: string, from: Date): number {
  const [h, m] = ringTime.split(':').map(Number);
  const candidate = new Date(from);
  const dayDiff = (dayOfWeek - from.getDay() + 7) % 7;
  candidate.setDate(from.getDate() + dayDiff);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate.getTime();
}

function isHoliday(db: ReturnType<typeof getDb>, dateStr: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM holidays WHERE date <= ? AND (end_date IS NULL OR end_date >= ?) LIMIT 1`
    )
    .get(dateStr, dateStr);
  return !!row;
}

function buildStatus() {
  const db = getDb();
  const schoolNameRow = db.prepare(`SELECT value FROM settings WHERE key = 'school_name'`).get() as
    | { value?: string }
    | undefined;

  const bells = db
    .prepare(`SELECT id, title, day_of_week, ring_time, category FROM schedules WHERE is_active = 1`)
    .all() as BellRow[];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayIsHoliday = isHoliday(db, todayStr);

  const withNext = bells.map((b) => ({ bell: b, atMs: nextOccurrenceMs(b.day_of_week, b.ring_time, now) }));
  withNext.sort((a, b) => a.atMs - b.atMs);
  const next = withNext[0];

  const todayBells = bells
    .filter((b) => b.day_of_week === now.getDay())
    .sort((a, b) => a.ring_time.localeCompare(b.ring_time));

  return {
    schoolName: schoolNameRow?.value ?? 'My School',
    now: now.toISOString(),
    todayIsHoliday,
    next: next
      ? {
          title: next.bell.title,
          category: next.bell.category,
          ringTime: next.bell.ring_time,
          ringTimeDisplay: formatTime12h(next.bell.ring_time),
          atMs: next.atMs,
          dayName: DAY_NAMES[new Date(next.atMs).getDay()],
          isToday: new Date(next.atMs).toDateString() === now.toDateString(),
        }
      : null,
    todayBells: todayBells.map((b) => ({
      title: b.title,
      category: b.category,
      ringTime: b.ring_time,
      ringTimeDisplay: formatTime12h(b.ring_time),
    })),
  };
}

function renderPage(): string {
  // Page is intentionally self-contained (inline CSS/JS, no external
  // assets) so it works the moment someone opens the IP address - no
  // separate static files to ship or fetch.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenBell - Next Bell</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: #0f172a; color: #f1f5f9; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card { max-width: 420px; width: 100%; text-align: center; }
  .school { font-size: 14px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; }
  .label { font-size: 15px; color: #94a3b8; margin-bottom: 4px; }
  .bell-title { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
  .countdown { font-size: 56px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
  .ring-time { margin-top: 8px; font-size: 16px; color: #cbd5e1; }
  .day-tag { display: inline-block; margin-top: 10px; font-size: 12px; background: #1e293b; padding: 4px 10px; border-radius: 999px; color: #93c5fd; }
  .today-list { margin-top: 32px; text-align: left; border-top: 1px solid #1e293b; padding-top: 16px; }
  .today-list h3 { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
  .bell-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #e2e8f0; border-bottom: 1px solid #1e293b; }
  .bell-row:last-child { border-bottom: none; }
  .empty { color: #64748b; font-size: 14px; margin-top: 24px; }
  .updated { margin-top: 24px; font-size: 11px; color: #475569; }
</style>
</head>
<body>
  <div class="card">
    <div class="school" id="school">OpenBell</div>
    <div id="content">Loading...</div>
    <div class="updated" id="updated"></div>
  </div>

<script>
let nextAtMs = null;

function pad(n) { return String(n).padStart(2, '0'); }

function renderCountdown() {
  const el = document.getElementById('countdown');
  if (!el || nextAtMs === null) return;
  const diff = Math.max(0, nextAtMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  el.textContent = hh > 0 ? (pad(hh) + ':' + pad(mm) + ':' + pad(ss)) : (pad(mm) + ':' + pad(ss));
}

async function refresh() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('school').textContent = data.schoolName;

    const content = document.getElementById('content');
    if (data.todayIsHoliday) {
      content.innerHTML = '<div class="empty">No school today (holiday)</div>';
      nextAtMs = null;
    } else if (!data.next) {
      content.innerHTML = '<div class="empty">No upcoming bells scheduled</div>';
      nextAtMs = null;
    } else {
      nextAtMs = data.next.atMs;
      let html = '<div class="label">Next Bell</div>';
      html += '<div class="bell-title">' + data.next.title + '</div>';
      html += '<div class="countdown" id="countdown">--:--</div>';
      html += '<div class="ring-time">' + data.next.ringTimeDisplay + '</div>';
      if (!data.next.isToday) {
        html += '<div class="day-tag">' + data.next.dayName + '</div>';
      }
      if (data.todayBells && data.todayBells.length > 0) {
        html += '<div class="today-list"><h3>Today\\'s Bells</h3>';
        for (const b of data.todayBells) {
          html += '<div class="bell-row"><span>' + b.title + '</span><span>' + b.ringTimeDisplay + '</span></div>';
        }
        html += '</div>';
      }
      content.innerHTML = html;
      renderCountdown();
    }
    document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    document.getElementById('content').innerHTML = '<div class="empty">Connection lost - retrying...</div>';
  }
}

setInterval(renderCountdown, 1000);
setInterval(refresh, 30000);
refresh();
</script>
</body>
</html>`;
}

export function startViewerServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve();
      return;
    }
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.url === '/api/status') {
        try {
          const status = buildStatus();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage());
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
      writeLog('info', 'system', `Remote viewer started on port ${port}`);
      resolve();
    });
  });
}

export function stopViewerServer(): void {
  if (server) {
    server.close();
    server = null;
    writeLog('info', 'system', 'Remote viewer stopped');
  }
}

export function isViewerServerRunning(): boolean {
  return server !== null;
}

import cron from 'node-cron';
import { getDb } from '../database/db';
import { writeLog } from './logger';
import { ringBellWithConfirmation } from './bellHealthMonitor';

interface ScheduleRow {
  id: number;
  title: string;
  day_of_week: number;
  ring_time: string;
  sound_id: number | null;
  category: string;
  is_active: number;
}

let task: cron.ScheduledTask | null = null;

/** Reads the school's configured timezone (IANA name) from settings. */
function getTimezone(): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'timezone'`).get() as
    | { value: string }
    | undefined;
  return row?.value || 'Asia/Colombo';
}

/**
 * Returns { dayOfWeek, currentTime, dateStr } describing "now" as it
 * actually is in the configured school timezone — independent of what
 * timezone the underlying OS / server happens to be set to. This is what
 * lets a single build behave correctly whether the PC's Windows clock is
 * set to Colombo, Chennai, Dubai, or anywhere else.
 */
function getNowInTimezone(timeZone: string): { dayOfWeek: number; currentTime: string; dateStr: string } {
  const now = new Date();

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    // Invalid/unsupported timezone string saved in settings — fall back to
    // the OS local time rather than crashing the scheduler.
    const dayOfWeek = now.getDay();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return { dayOfWeek, currentTime: `${hh}:${mm}`, dateStr: now.toISOString().slice(0, 10) };
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  let hour = get('hour');
  if (hour === '24') hour = '00'; // some locales render midnight as 24
  const minute = get('minute');
  const year = get('year');
  const month = get('month');
  const day = get('day');

  return {
    dayOfWeek: weekdayMap[get('weekday')] ?? now.getDay(),
    currentTime: `${hour}:${minute}`,
    dateStr: `${year}-${month}-${day}`,
  };
}

/**
 * Checks whether `date` falls within any holiday range stored in the
 * `holidays` table. If so, bells should not ring that day.
 */
function isHoliday(dateStr: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM holidays
       WHERE date <= ? AND (end_date IS NULL OR end_date >= ?)
       LIMIT 1`
    )
    .get(dateStr, dateStr);
  return !!row;
}

/**
 * Core tick function — runs every minute, checks if any active
 * schedule matches the current day/time (in the school's configured
 * timezone), and triggers playback.
 */
function tick(): void {
  const timeZone = getTimezone();
  const { dayOfWeek, currentTime, dateStr: today } = getNowInTimezone(timeZone);

  if (isHoliday(today)) return;

  const db = getDb();
  const matches = db
    .prepare(
      `SELECT * FROM schedules
       WHERE day_of_week = ? AND ring_time = ? AND is_active = 1`
    )
    .all(dayOfWeek, currentTime) as ScheduleRow[];

  for (const schedule of matches) {
    try {
      ringBellWithConfirmation(schedule);
    } catch (err) {
      writeLog('error', 'bell', `Failed to ring bell: ${schedule.title}`, { error: String(err) }, schedule.id);
    }
  }
}

/** Starts the background cron-based scheduler (runs once per minute). */
export function startScheduler(): void {
  if (task) return;
  task = cron.schedule('* * * * *', tick);
  writeLog('info', 'system', 'Scheduler engine started');
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
    writeLog('info', 'system', 'Scheduler engine stopped');
  }
}

/** Exposed for unit tests so the tick logic can be exercised directly. */
export const __test__ = { tick, isHoliday, getNowInTimezone };


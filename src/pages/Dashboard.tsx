import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Volume2, ShieldCheck, DatabaseBackup, Bell, ShieldAlert } from 'lucide-react';
import StatCard from '@/components/Card';
import type { Schedule } from '@/types';
import { formatTime, dayName } from '@/utils/format';

// Given a schedule's day_of_week (0=Sun..6=Sat) and "HH:MM" ring_time,
// returns the next real Date/time this bell will ring (today if it
// hasn't happened yet, otherwise the next matching weekday).
function nextOccurrence(dayOfWeek: number, ringTime: string, from: Date): Date {
  const [h, m] = ringTime.split(':').map(Number);
  const candidate = new Date(from);
  const dayDiff = (dayOfWeek - from.getDay() + 7) % 7;
  candidate.setDate(from.getDate() + dayDiff);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    // Same weekday but time already passed today -> push a full week ahead
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [soundCount, setSoundCount] = useState(0);
  const [allActiveSchedules, setAllActiveSchedules] = useState<Schedule[]>([]);
  const [now, setNow] = useState(new Date());
  const [bellHealth, setBellHealth] = useState<{
    failuresLast24h: number;
    lastFailure: { title: string; ringTime: string; reason: string; at: string } | null;
  } | null>(null);

  useEffect(() => {
    window.openbell?.getBellHealthSummary().then(setBellHealth).catch(() => setBellHealth(null));
    // Refresh periodically so the indicator doesn't go stale while the
    // Dashboard is left open in the background all day.
    const t = setInterval(() => {
      window.openbell?.getBellHealthSummary().then(setBellHealth).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = new Date().getDay();
    window.openbell
      ?.query<Schedule>(
        'SELECT * FROM schedules WHERE day_of_week = ? AND is_active = 1 ORDER BY ring_time ASC',
        [today]
      )
      .then(setSchedules)
      .catch(() => setSchedules([]));

    window.openbell
      ?.query<{ count: number }>('SELECT COUNT(*) as count FROM sounds')
      .then((rows) => setSoundCount(rows[0]?.count ?? 0))
      .catch(() => setSoundCount(0));

    // Pull every active schedule (any day) once, so we can work out
    // whichever bell - today or on a later day - is coming up next.
    window.openbell
      ?.query<Schedule>('SELECT * FROM schedules WHERE is_active = 1')
      .then(setAllActiveSchedules)
      .catch(() => setAllActiveSchedules([]));
  }, []);

  // Tick every second so the countdown stays live.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const upcoming = allActiveSchedules
    .map((s) => ({ schedule: s, at: nextOccurrence(s.day_of_week, s.ring_time, now) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  const isToday = upcoming && upcoming.at.toDateString() === now.toDateString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
      </div>

      {bellHealth && (
        <div
          className={`card flex items-center gap-3 ${
            bellHealth.failuresLast24h > 0
              ? 'bg-rose-50 dark:bg-rose-900/20'
              : 'bg-emerald-50 dark:bg-emerald-900/20'
          }`}
        >
          {bellHealth.failuresLast24h > 0 ? (
            <ShieldAlert size={20} className="text-rose-600 dark:text-rose-400" />
          ) : (
            <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
          )}
          <div className="text-sm">
            {bellHealth.failuresLast24h > 0 ? (
              <span className="text-rose-700 dark:text-rose-300">
                {t('dashboard.bellHealthFailures', { count: bellHealth.failuresLast24h })}
                {bellHealth.lastFailure && (
                  <> — {t('dashboard.lastFailureWas', { title: bellHealth.lastFailure.title, time: bellHealth.lastFailure.ringTime })}</>
                )}
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.bellHealthOk')}</span>
            )}
          </div>
        </div>
      )}

      {upcoming && (
        <div className="card flex items-center gap-4 bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/30 dark:to-transparent">
          <div className="rounded-xl p-3 bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300">
            <Bell size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.nextBell')} · {upcoming.schedule.title}
              {!isToday && <> · {dayName(upcoming.at.getDay())}</>}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums">
              {formatCountdown(upcoming.at.getTime() - now.getTime())}
            </p>
          </div>
          <span className="font-mono text-sm bg-white/60 dark:bg-slate-700 px-2.5 py-1 rounded-lg self-start">
            {formatTime(upcoming.schedule.ring_time)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.totalSchedules')} value={schedules.length} icon={CalendarClock} />
        <StatCard title={t('dashboard.totalSounds')} value={soundCount} icon={Volume2} accent="green" />
        <StatCard title={t('dashboard.schedulerRunning')} value="Active" icon={ShieldCheck} accent="amber" />
        <StatCard title={t('dashboard.nextBackup')} value="In 7 days" icon={DatabaseBackup} accent="rose" />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">
          {t('dashboard.upcomingBells')} — {dayName(new Date().getDay())}
        </h2>
        {schedules.length === 0 ? (
          <p className="text-sm text-slate-400">No bells scheduled for today.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-slate-400 capitalize">{s.category}</p>
                </div>
                <span className="font-mono text-sm bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                  {formatTime(s.ring_time)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Volume2, ShieldCheck, DatabaseBackup } from 'lucide-react';
import StatCard from '@/components/Card';
import type { Schedule } from '@/types';
import { formatTime, dayName } from '@/utils/format';

export default function Dashboard() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [soundCount, setSoundCount] = useState(0);

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
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
      </div>

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

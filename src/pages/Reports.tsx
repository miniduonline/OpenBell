import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { LogEntry } from '@/types';
import { toCSV } from '@/utils/format';

/** Format an ISO/SQLite datetime string as Sri Lanka local time (Asia/Colombo). */
function formatSLT(isoStr: string): string {
  if (!isoStr) return '';
  try {
    // SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"; Date expects ISO 8601.
    const normalized = isoStr.replace(' ', 'T') + (isoStr.includes('T') ? '' : 'Z');
    return new Intl.DateTimeFormat('en-LK', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(normalized));
  } catch {
    return isoStr;
  }
}

/** Returns today's date string in YYYY-MM-DD format in Asia/Colombo timezone. */
function todaySLT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
}

/** Returns the date string for N days ago in YYYY-MM-DD format in Asia/Colombo timezone. */
function daysAgoSLT(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(d);
}

export default function Reports() {
  const today = todaySLT();
  const sevenDaysAgo = daysAgoSLT(7);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = (from: string, to: string) => {
    // toDate is inclusive — extend it to end-of-day for the comparison
    const toEndOfDay = to + ' 23:59:59';
    const fromStart = from + ' 00:00:00';

    window.openbell
      ?.query<LogEntry>(
        `SELECT * FROM logs
         WHERE created_at >= ? AND created_at <= ?
         ORDER BY created_at DESC
         LIMIT 500`,
        [fromStart, toEndOfDay]
      )
      .then(setLogs)
      .catch(() => setLogs([]));
  };

  useEffect(() => {
    load(fromDate, toDate);
  }, []);

  const applyFilter = () => load(fromDate, toDate);

  const filteredLogs =
    categoryFilter === 'all' ? logs : logs.filter((l) => l.category === categoryFilter);

  const exportCSV = async () => {
    const rows = filteredLogs.map((l) => ({
      ...l,
      created_at: formatSLT(l.created_at),
    }));
    const csv = toCSV(rows as unknown as Record<string, unknown>[]);
    await window.openbell.saveFile(
      `openbell-activity-log-${fromDate}-to-${toDate}.csv`,
      csv
    );
  };

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-rose-600 dark:text-rose-400';
      case 'warn':  return 'text-amber-600 dark:text-amber-400';
      case 'debug': return 'text-slate-400';
      default:      return 'text-emerald-600 dark:text-emerald-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports & Activity Logs</h1>
        <button className="btn-secondary flex items-center gap-2" onClick={exportCSV}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">From date (Sri Lanka time)</label>
          <input
            type="date"
            className="input-field"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">To date (Sri Lanka time)</label>
          <input
            type="date"
            className="input-field"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Category</label>
          <select
            className="input-field"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="bell">Bell</option>
            <option value="schedule">Schedule</option>
            <option value="system">System</option>
            <option value="backup">Backup</option>
            <option value="auth">Auth</option>
          </select>
        </div>
        <button className="btn-primary" onClick={applyFilter}>
          Apply
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            setFromDate(sevenDaysAgo);
            setToDate(today);
            setCategoryFilter('all');
            load(sevenDaysAgo, today);
          }}
        >
          Reset
        </button>
        <p className="text-xs text-slate-400 self-center ml-auto">
          All times shown in Sri Lanka time (Asia/Colombo)
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-700">
              <th className="py-2 pr-4">Time (SLT)</th>
              <th className="pr-4">Level</th>
              <th className="pr-4">Category</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredLogs.map((l) => (
              <tr key={l.id}>
                <td className="py-2 font-mono text-xs whitespace-nowrap pr-4">
                  {formatSLT(l.created_at)}
                </td>
                <td className={`capitalize pr-4 font-medium ${levelColor(l.level)}`}>
                  {l.level}
                </td>
                <td className="capitalize pr-4">{l.category}</td>
                <td>{l.message}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  No log entries found for the selected date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredLogs.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            Showing {filteredLogs.length} {filteredLogs.length === 500 ? '(max 500)' : ''} entries
          </p>
        )}
      </div>
    </div>
  );
}

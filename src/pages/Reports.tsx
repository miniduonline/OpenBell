import { useEffect, useMemo, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, BellRing } from 'lucide-react';
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

function todaySLT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
}

function daysAgoSLT(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(d);
}

function parseMeta(meta?: string | null): Record<string, unknown> {
  if (!meta) return {};
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

export default function Reports() {
  const { t } = useTranslation();
  const today = todaySLT();
  const sevenDaysAgo = daysAgoSLT(7);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = (from: string, to: string) => {
    const toEndOfDay = to + ' 23:59:59';
    const fromStart = from + ' 00:00:00';

    window.openbell
      ?.query<LogEntry>(
        `SELECT * FROM logs
         WHERE created_at >= ? AND created_at <= ?
         ORDER BY created_at DESC
         LIMIT 1000`,
        [fromStart, toEndOfDay]
      )
      .then(setLogs)
      .catch(() => setLogs([]));
  };

  useEffect(() => {
    load(fromDate, toDate);
  }, []);

  const applyFilter = () => load(fromDate, toDate);

  // ---- Bell-specific health stats (the "very advanced" part) -----------------------
  // Every bell ring (success or failure) is logged under category='bell' by the
  // Bell Health Monitor (see electron/services/bellHealthMonitor.ts). We derive
  // a reliability summary directly from those entries, no separate table needed.
  const bellStats = useMemo(() => {
    const bellLogs = logs.filter((l) => l.category === 'bell');
    const failed = bellLogs.filter((l) => l.level === 'error');
    const success = bellLogs.filter((l) => l.level === 'info');
    const total = bellLogs.length;
    const reliability = total > 0 ? Math.round((success.length / total) * 100) : 100;

    const latencies = success
      .map((l) => parseMeta(l.meta).latencyMs)
      .filter((v): v is number => typeof v === 'number');
    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    return { total, successCount: success.length, failedCount: failed.length, reliability, avgLatency };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (outcomeFilter === 'success' && l.level !== 'info') return false;
      if (outcomeFilter === 'failed' && l.level !== 'error') return false;
      if (searchText.trim()) {
        const haystack = (l.message + ' ' + (l.meta ?? '')).toLowerCase();
        if (!haystack.includes(searchText.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [logs, categoryFilter, outcomeFilter, searchText]);

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
        <h1 className="text-2xl font-bold">{t('reports.pageTitle')}</h1>
        <button className="btn-secondary flex items-center gap-2" onClick={exportCSV}>
          <Download size={16} /> {t('reports.exportCsv')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-slate-400">{t('reports.bellReliability')}</p>
          <p
            className={`text-2xl font-bold ${
              bellStats.reliability === 100 ? 'text-emerald-600' : bellStats.reliability >= 90 ? 'text-amber-600' : 'text-rose-600'
            }`}
          >
            {bellStats.reliability}%
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">{t('reports.bellsRungOk')}</p>
          <p className="text-2xl font-bold flex items-center gap-1.5 text-emerald-600">
            <ShieldCheck size={18} /> {bellStats.successCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">{t('reports.bellsFailed')}</p>
          <p className="text-2xl font-bold flex items-center gap-1.5 text-rose-600">
            <ShieldAlert size={18} /> {bellStats.failedCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">{t('reports.avgResponseTime')}</p>
          <p className="text-2xl font-bold flex items-center gap-1.5">
            <BellRing size={18} className="text-slate-400" />
            {bellStats.avgLatency !== null ? `${bellStats.avgLatency}ms` : '—'}
          </p>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">{t('reports.fromDate')}</label>
          <input
            type="date"
            className="input-field"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">{t('reports.toDate')}</label>
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
          <label className="text-xs text-slate-400">{t('reports.category')}</label>
          <select
            className="input-field"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{t('reports.allCategories')}</option>
            <option value="bell">{t('reports.catBell')}</option>
            <option value="schedule">{t('reports.catSchedule')}</option>
            <option value="system">{t('reports.catSystem')}</option>
            <option value="backup">{t('reports.catBackup')}</option>
            <option value="auth">{t('reports.catAuth')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">{t('reports.outcome')}</label>
          <select
            className="input-field"
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as 'all' | 'success' | 'failed')}
          >
            <option value="all">{t('reports.outcomeAll')}</option>
            <option value="success">{t('reports.outcomeSuccessOnly')}</option>
            <option value="failed">{t('reports.outcomeFailedOnly')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs text-slate-400">{t('reports.search')}</label>
          <input
            type="text"
            className="input-field"
            placeholder={t('reports.searchPlaceholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={applyFilter}>
          {t('reports.apply')}
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            setFromDate(sevenDaysAgo);
            setToDate(today);
            setCategoryFilter('all');
            setOutcomeFilter('all');
            setSearchText('');
            load(sevenDaysAgo, today);
          }}
        >
          {t('reports.reset')}
        </button>
        <p className="text-xs text-slate-400 self-center ml-auto">
          {t('reports.timezoneNote')}
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-700">
              <th className="py-2 pr-2 w-6"></th>
              <th className="py-2 pr-4">{t('reports.colTime')}</th>
              <th className="pr-4">{t('reports.colLevel')}</th>
              <th className="pr-4">{t('reports.colCategory')}</th>
              <th>{t('reports.colMessage')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredLogs.map((l) => {
              const meta = parseMeta(l.meta);
              const hasMeta = Object.keys(meta).length > 0;
              const isExpanded = expandedId === l.id;
              return (
                <Fragment key={l.id}>
                  <tr
                    className={hasMeta ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                    onClick={() => hasMeta && setExpandedId(isExpanded ? null : l.id)}
                  >
                    <td className="py-2 pr-2 text-slate-400">
                      {hasMeta && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                    </td>
                    <td className="py-2 font-mono text-xs whitespace-nowrap pr-4">
                      {formatSLT(l.created_at)}
                    </td>
                    <td className={`capitalize pr-4 font-medium ${levelColor(l.level)}`}>
                      {l.level}
                    </td>
                    <td className="capitalize pr-4">{l.category}</td>
                    <td>{l.message}</td>
                  </tr>
                  {isExpanded && hasMeta && (
                    <tr>
                      <td></td>
                      <td colSpan={4} className="pb-3">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs font-mono space-y-1">
                          {Object.entries(meta).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-slate-400 min-w-[110px]">{key}:</span>
                              <span className="text-slate-700 dark:text-slate-300">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  {t('reports.noEntries')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredLogs.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            {t('reports.showingEntries', { count: filteredLogs.length })} {filteredLogs.length === 1000 ? t('reports.maxEntriesNote') : ''}
          </p>
        )}
      </div>
    </div>
  );
}

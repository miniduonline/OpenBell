import { useEffect, useState } from 'react';
import { DatabaseBackup, RotateCcw } from 'lucide-react';
import type { BackupRecord } from '@/types';

export default function Backup() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    window.openbell?.query<BackupRecord>('SELECT * FROM backups ORDER BY created_at DESC').then(setBackups);
  };
  useEffect(load, []);

  const runBackup = async () => {
    setBusy(true);
    try {
      await window.openbell.createBackup();
      load();
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await window.openbell.restoreBackup();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backup & Restore</h1>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={restore} disabled={busy}>
            <RotateCcw size={16} /> Restore
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={runBackup} disabled={busy}>
            <DatabaseBackup size={16} /> Backup Now
          </button>
        </div>
      </div>

      <div className="card">
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {backups.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{b.file_path.split(/[\\/]/).pop()}</p>
                <p className="text-xs text-slate-400">
                  {b.created_at} · {(b.size_bytes / 1024).toFixed(1)} KB · <span className="capitalize">{b.type}</span>
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  b.status === 'success'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                {b.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

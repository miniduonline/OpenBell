import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { Holiday } from '@/types';

export default function Holidays() {
  const { t } = useTranslation();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState({ title: '', date: '', type: 'school' as Holiday['type'] });

  const load = () => {
    window.openbell?.query<Holiday>('SELECT * FROM holidays ORDER BY date ASC').then(setHolidays);
  };
  useEffect(load, []);

  const add = async () => {
    if (!form.title || !form.date) return;
    await window.openbell.run('INSERT INTO holidays (title, date, type) VALUES (?,?,?)', [
      form.title,
      form.date,
      form.type,
    ]);
    setForm({ title: '', date: '', type: 'school' });
    load();
  };

  const remove = async (id: number) => {
    await window.openbell.run('DELETE FROM holidays WHERE id = ?', [id]);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('holidays.pageTitle')}</h1>

      <div className="card grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          className="input-field sm:col-span-2"
          placeholder={t('holidays.titlePlaceholder')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="date"
          className="input-field"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <select
          className="input-field"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as Holiday['type'] })}
        >
          <option value="school">{t('holidays.typeSchool')}</option>
          <option value="public">{t('holidays.typePublic')}</option>
          <option value="exception">{t('holidays.typeException')}</option>
        </select>
        <button className="btn-primary flex items-center gap-2 justify-center sm:col-span-4" onClick={add}>
          <Plus size={16} /> {t('holidays.addHoliday')}
        </button>
      </div>

      <div className="card">
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{h.title}</p>
                <p className="text-xs text-slate-400">
                  {h.date} · <span className="capitalize">{t(`holidays.type${h.type.charAt(0).toUpperCase()}${h.type.slice(1)}`)}</span>
                </p>
              </div>
              <button onClick={() => remove(h.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-rose-500">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

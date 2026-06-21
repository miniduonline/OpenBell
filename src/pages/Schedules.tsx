import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Copy } from 'lucide-react';
import type { Schedule, Sound } from '@/types';
import { DAY_NAMES, formatTime } from '@/utils/format';

const emptyForm: Partial<Schedule> = {
  title: '',
  day_of_week: 1,
  ring_time: '08:00',
  sound_id: null,
  category: 'class',
  is_active: 1,
};

// Mon..Fri as day_of_week values (0=Sun..6=Sat) — used by the "Weekdays"
// quick-select button in the day-copy panel below.
const WEEKDAYS = [1, 2, 3, 4, 5];

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [form, setForm] = useState<Partial<Schedule>>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // ---- Copy a day's bells to other days ------------------------------------------
  // Lets the user set up one day (e.g. Monday) and then reuse that whole set
  // of bells on other days (e.g. the rest of the school week) instead of
  // re-creating every bell by hand for each day.
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState(1); // Monday
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState('');

  const load = () => {
    window.openbell
      ?.query<Schedule>('SELECT * FROM schedules ORDER BY day_of_week ASC, ring_time ASC')
      .then(setSchedules)
      .catch(() => setSchedules([]));
  };

  const loadSounds = () => {
    window.openbell
      ?.query<Sound>('SELECT * FROM sounds ORDER BY name ASC')
      .then(setSounds)
      .catch(() => setSounds([]));
  };

  useEffect(() => {
    load();
    loadSounds();
  }, []);

  const save = async () => {
    if (!form.title || !form.ring_time) return;
    if (editingId) {
      await window.openbell.run(
        `UPDATE schedules SET title=?, day_of_week=?, ring_time=?, sound_id=?, category=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
        [form.title, form.day_of_week, form.ring_time, form.sound_id ?? null, form.category, form.is_active, editingId]
      );
    } else {
      await window.openbell.run(
        `INSERT INTO schedules (title, day_of_week, ring_time, sound_id, category, is_active) VALUES (?,?,?,?,?,?)`,
        [form.title, form.day_of_week, form.ring_time, form.sound_id ?? null, form.category, form.is_active ?? 1]
      );
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    await window.openbell.run('DELETE FROM schedules WHERE id = ?', [id]);
    load();
  };

  const edit = (s: Schedule) => {
    setForm(s);
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleActive = async (s: Schedule) => {
    await window.openbell.run(
      `UPDATE schedules SET is_active=?, updated_at=datetime('now') WHERE id=?`,
      [s.is_active ? 0 : 1, s.id]
    );
    load();
  };

  const toggleCopyTargetDay = (day: number) => {
    setCopyTargetDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Quick-select: every weekday except whichever day is currently the
  // source (so picking Monday as the source and clicking this selects
  // Tue–Fri, matching the common "set Monday once, reuse all week" case).
  const selectWeekdayTargets = () => {
    setCopyTargetDays(WEEKDAYS.filter((d) => d !== copySourceDay));
  };

  const copyDayToOtherDays = async () => {
    if (copyTargetDays.length === 0) {
      setCopyResult('Pick at least one day to copy to.');
      return;
    }

    setCopying(true);
    setCopyResult('');
    try {
      const sourceSchedules = await window.openbell.query<Schedule>(
        'SELECT * FROM schedules WHERE day_of_week = ?',
        [copySourceDay]
      );

      if (sourceSchedules.length === 0) {
        setCopyResult(`No bells are set for ${DAY_NAMES[copySourceDay]} yet — nothing to copy.`);
        setCopying(false);
        return;
      }

      // Look up what's already on the target days so re-running this (e.g.
      // by mistake) doesn't create duplicate bells — a bell is considered
      // "already there" if a target day already has the same title at the
      // same ring time.
      const placeholders = copyTargetDays.map(() => '?').join(',');
      const existingOnTargets = await window.openbell.query<Schedule>(
        `SELECT * FROM schedules WHERE day_of_week IN (${placeholders})`,
        copyTargetDays
      );

      let copiedCount = 0;
      let skippedCount = 0;

      for (const targetDay of copyTargetDays) {
        for (const s of sourceSchedules) {
          const alreadyThere = existingOnTargets.some(
            (e) => e.day_of_week === targetDay && e.title === s.title && e.ring_time === s.ring_time
          );
          if (alreadyThere) {
            skippedCount++;
            continue;
          }
          await window.openbell.run(
            `INSERT INTO schedules (title, day_of_week, ring_time, sound_id, category, is_active) VALUES (?,?,?,?,?,?)`,
            [s.title, targetDay, s.ring_time, s.sound_id ?? null, s.category, s.is_active]
          );
          copiedCount++;
        }
      }

      const dayWord = copyTargetDays.length === 1 ? 'day' : 'days';
      const bellWord = copiedCount === 1 ? 'bell' : 'bells';
      setCopyResult(
        `✅ Copied ${copiedCount} ${bellWord} from ${DAY_NAMES[copySourceDay]} to ${copyTargetDays.length} ${dayWord}.` +
          (skippedCount > 0 ? ` (${skippedCount} already existed and were skipped.)` : '')
      );
      load();
    } catch (e) {
      setCopyResult('❌ Copy failed. Please try again.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Bell Schedules</h1>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => {
              setShowForm(false);
              setCopyResult('');
              setShowCopyPanel((v) => !v);
            }}
          >
            <Copy size={16} /> Copy Day to Other Days
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => {
              setShowCopyPanel(false);
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Add Schedule
          </button>
        </div>
      </div>

      {showCopyPanel && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold">Copy Day to Other Days</h2>
            <p className="text-xs text-slate-400 mt-1">
              Already set up all the bells for one day? Copy that whole set straight onto other days instead of
              re-creating each one — e.g. set up Monday once, then copy it onto Tuesday–Friday.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Copy bells from</label>
              <select
                className="input-field"
                value={copySourceDay}
                onChange={(e) => {
                  const day = Number(e.target.value);
                  setCopySourceDay(day);
                  // Don't let the source day also be selected as a target.
                  setCopyTargetDays((prev) => prev.filter((d) => d !== day));
                }}
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Copy to these days</label>
                <button type="button" className="text-xs text-primary-600 hover:underline" onClick={selectWeekdayTargets}>
                  Select Mon–Fri
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAY_NAMES.map((d, i) =>
                  i === copySourceDay ? null : (
                    <label
                      key={d}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer select-none ${
                        copyTargetDays.includes(i)
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={copyTargetDays.includes(i)}
                        onChange={() => toggleCopyTargetDay(i)}
                      />
                      {d}
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          {copyResult && <p className="text-sm">{copyResult}</p>}

          <div className="flex gap-2">
            <button className="btn-primary" disabled={copying} onClick={copyDayToOtherDays}>
              {copying ? 'Copying...' : 'Copy'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowCopyPanel(false);
                setCopyResult('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            className="input-field sm:col-span-2"
            placeholder="Title (e.g. Period 1 Start)"
            value={form.title ?? ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="input-field"
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            className="input-field"
            value={form.ring_time}
            onChange={(e) => setForm({ ...form, ring_time: e.target.value })}
          />
          <select
            className="input-field sm:col-span-2"
            value={form.sound_id ?? ''}
            onChange={(e) => setForm({ ...form, sound_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— No sound selected —</option>
            {sounds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as Schedule['category'] })}
          >
            <option value="class">Class</option>
            <option value="break">Break</option>
            <option value="assembly">Assembly</option>
            <option value="exam">Exam</option>
            <option value="custom">Custom</option>
          </select>
          <select
            className="input-field"
            value={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) as 0 | 1 })}
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
          <div className="flex gap-2 sm:col-span-4">
            <button className="btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {sounds.length === 0 && (
        <div className="card text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          ⚠️ No sounds uploaded yet. Go to <strong>Bell Sounds</strong> page and upload an audio file first, then assign it to a schedule.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-700">
              <th className="py-2">Title</th>
              <th>Day</th>
              <th>Time</th>
              <th>Sound</th>
              <th>Category</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {schedules.map((s) => {
              const sound = sounds.find((snd) => snd.id === s.sound_id);
              return (
                <tr key={s.id}>
                  <td className="py-3 font-medium">{s.title}</td>
                  <td>{DAY_NAMES[s.day_of_week]}</td>
                  <td className="font-mono">{formatTime(s.ring_time)}</td>
                  <td className={sound ? '' : 'text-rose-400 text-xs'}>
                    {sound ? sound.name : '⚠ No sound'}
                  </td>
                  <td className="capitalize">{s.category}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(s)}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                        s.is_active
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                      }`}
                    >
                      {s.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="flex gap-2 justify-end py-2">
                    <button onClick={() => edit(s)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remove(s.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No schedules yet. Click "Add Schedule" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

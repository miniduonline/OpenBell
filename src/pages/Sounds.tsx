import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Upload, Trash2 } from 'lucide-react';
import type { Sound } from '@/types';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import UndoSnackbar from '@/components/UndoSnackbar';

export default function Sounds() {
  const { t } = useTranslation();
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => {
    window.openbell?.query<Sound>('SELECT * FROM sounds ORDER BY created_at DESC').then(setSounds);
  };
  useEffect(load, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-uploaded if needed
    e.target.value = '';
    const buffer = await file.arrayBuffer();
    const savedPath = await window.openbell.uploadSound(buffer, file.name);
    await window.openbell.run(
      'INSERT INTO sounds (name, file_path, volume) VALUES (?, ?, 80)',
      [file.name, savedPath]
    );
    load();
  };

  const preview = async (s: Sound) => {
    setPreviewingId(s.id);
    await window.openbell.previewSound(s.file_path, s.volume);
    // Reset the indicator after 3 s (approximate bell duration)
    setTimeout(() => setPreviewingId((id) => (id === s.id ? null : id)), 3000);
  };

  const { pendingItem: pendingDelete, scheduleDelete, undo, undoWindowMs } = useUndoableDelete<Sound>(
    async (item) => {
      await window.openbell.run('DELETE FROM sounds WHERE id = ?', [item.id]);
    }
  );

  const remove = (s: Sound) => {
    scheduleDelete(
      s,
      (item) => setSounds((prev) => prev.filter((x) => x.id !== item.id)),
      (item) => setSounds((prev) => [item, ...prev])
    );
  };

  const setVolume = async (id: number, volume: number) => {
    await window.openbell.run('UPDATE sounds SET volume = ?, updated_at = datetime(\'now\') WHERE id = ?', [volume, id]);
    // Update local state immediately for responsive slider (no full reload)
    setSounds((prev) => prev.map((s) => (s.id === id ? { ...s, volume } : s)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.sounds')}</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => fileInput.current?.click()}>
          <Upload size={16} /> {t('sounds.uploadSound')}
        </button>
        <input ref={fileInput} type="file" accept=".mp3,.wav,.ogg" className="hidden" onChange={handleUpload} />
      </div>

      {sounds.length === 0 && (
        <div className="card text-sm text-slate-500 text-center py-10">
          {t('sounds.emptyStatePart1')} <strong>{t('sounds.uploadSound')}</strong> {t('sounds.emptyStatePart2')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sounds.map((s) => (
          <div key={s.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium truncate flex-1 mr-2" title={s.name}>{s.name}</p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => preview(s)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    previewingId === s.id
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 animate-pulse'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-primary-600'
                  }`}
                  title={t('sounds.previewSound')}
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={() => remove(s)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-rose-500"
                  title={t('sounds.deleteSound')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <label className="text-xs text-slate-400">{t('sounds.volume')}: {s.volume}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={s.volume}
              onChange={(e) =>
                setSounds((prev) => prev.map((x) => (x.id === s.id ? { ...x, volume: Number(e.target.value) } : x)))
              }
              onMouseUp={(e) => setVolume(s.id, Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => setVolume(s.id, Number((e.target as HTMLInputElement).value))}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {pendingDelete && (
        <UndoSnackbar
          message={t('sounds.deletedMessage', { name: pendingDelete.name })}
          durationMs={undoWindowMs}
          undoLabel={t('common.undo')}
          onUndo={() => undo((item) => setSounds((prev) => [item, ...prev]))}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';

interface UndoSnackbarProps {
  message: string;
  durationMs: number;
  onUndo: () => void;
  undoLabel: string;
}

/**
 * Fixed-position snackbar shown for a few seconds after a delete, giving
 * the person a chance to undo it before it's gone for real. The actual
 * delete (DB call) only happens once this snackbar's timer runs out
 * uninterrupted - see useUndoableDelete in src/hooks/useUndoableDelete.ts.
 */
export default function UndoSnackbar({ message, durationMs, onUndo, undoLabel }: UndoSnackbarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
    }, 50);
    return () => clearInterval(interval);
  }, [durationMs]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm">{message}</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1.5 text-sm font-medium text-primary-300 hover:text-primary-200 shrink-0"
          >
            <Undo2 size={14} /> {undoLabel}
          </button>
        </div>
        <div className="h-0.5 bg-slate-600">
          <div
            className="h-full bg-primary-400 transition-all"
            style={{ width: `${progress}%`, transitionDuration: '50ms' }}
          />
        </div>
      </div>
    </div>
  );
}

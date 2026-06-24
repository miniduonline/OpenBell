import { useRef, useState, useCallback } from 'react';

const UNDO_WINDOW_MS = 5000;

/**
 * Generic "soft delete with undo" pattern, used by Schedules, Sounds, and
 * Holidays pages.
 *
 * How it works:
 *  1. scheduleDelete(item) removes the item from the visible list
 *     immediately (optimistic UI - feels instant) and starts a 5-second
 *     timer.
 *  2. If undo() is called before the timer fires, the item is restored to
 *     the list and the real database DELETE never happens.
 *  3. If the timer runs out untouched, commitDelete actually runs (the
 *     real DELETE FROM ... call passed in by the page).
 *
 * Only one pending delete is tracked at a time deliberately - deleting a
 * second item while one is already "in flight" immediately commits the
 * first delete rather than stacking timers, which keeps the snackbar and
 * the mental model simple ("one thing to undo at a time").
 */
export function useUndoableDelete<T>(commitDelete: (item: T) => Promise<void>) {
  const [pendingItem, setPendingItem] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<T | null>(null);

  const finalizePending = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const item = itemRef.current;
    itemRef.current = null;
    setPendingItem(null);
    return item;
  }, []);

  /** Call this from the delete button. `removeFromList` should remove the
   *  item from local UI state right away; `restoreToList` should put it
   *  back if the user hits Undo. */
  const scheduleDelete = useCallback(
    (item: T, removeFromList: (item: T) => void, restoreToList: (item: T) => void) => {
      // If something else is already pending, let that one commit for
      // real right now rather than silently losing track of it.
      const previous = finalizePending();
      if (previous) {
        commitDelete(previous).catch(() => {});
      }

      removeFromList(item);
      itemRef.current = item;
      setPendingItem(item);

      timeoutRef.current = setTimeout(() => {
        const toDelete = finalizePending();
        if (toDelete) {
          commitDelete(toDelete).catch(() => {
            // If the real delete fails (e.g. DB locked), bring it back
            // in the UI rather than silently losing the item.
            restoreToList(toDelete);
          });
        }
      }, UNDO_WINDOW_MS);
    },
    [commitDelete, finalizePending]
  );

  const undo = useCallback(
    (restoreToList: (item: T) => void) => {
      const item = finalizePending();
      if (item) restoreToList(item);
    },
    [finalizePending]
  );

  return { pendingItem, scheduleDelete, undo, undoWindowMs: UNDO_WINDOW_MS };
}

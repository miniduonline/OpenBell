import { useEffect } from 'react';
import { useAppStore } from '@/store/useStore';

/** Applies the persisted theme to the document root on first mount. */
export function useTheme() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return theme;
}

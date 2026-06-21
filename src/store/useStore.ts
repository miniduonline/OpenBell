import { create } from 'zustand';
import type { Language, ThemeMode } from '@/types';

interface AppState {
  theme: ThemeMode;
  language: Language;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: (localStorage.getItem('openbell-theme') as ThemeMode) || 'light',
  language: (localStorage.getItem('openbell-language') as Language) || 'en',
  sidebarCollapsed: false,

  setTheme: (theme) => {
    localStorage.setItem('openbell-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setLanguage: (language) => {
    localStorage.setItem('openbell-language', language);
    set({ language });
  },

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

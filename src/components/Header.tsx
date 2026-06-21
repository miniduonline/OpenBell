import { useEffect, useState } from 'react';
import { Moon, Sun, Menu, Languages, Lock } from 'lucide-react';
import { useAppStore } from '@/store/useStore';
import { useTranslation } from 'react-i18next';
import Clock from './Clock';
import type { Language } from '@/types';

interface HeaderProps {
  onLock?: () => void;
}

export default function Header({ onLock }: HeaderProps) {
  const { theme, toggleTheme, toggleSidebar, language, setLanguage } = useAppStore();
  const { i18n } = useTranslation();
  const [passwordEnabled, setPasswordEnabled] = useState(false);

  useEffect(() => {
    window.openbell?.authIsEnabled().then(setPasswordEnabled);
  }, []);

  const changeLanguage = (lng: Language) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur sticky top-0 z-10">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <Clock />

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value as Language)}
            className="appearance-none bg-slate-100 dark:bg-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm font-medium"
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="si">සිංහල</option>
            <option value="ta">தமிழ்</option>
          </select>
          <Languages size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {passwordEnabled && onLock && (
          <button
            onClick={onLock}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Lock now"
            title="Lock now"
          >
            <Lock size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

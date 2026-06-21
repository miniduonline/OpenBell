import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  CalendarClock,
  Volume2,
  CalendarOff,
  FileBarChart2,
  DatabaseBackup,
  Settings as SettingsIcon,
  BellRing,
  LifeBuoy,
} from 'lucide-react';
import { useAppStore } from '@/store/useStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/schedules', icon: CalendarClock, key: 'schedules' },
  { to: '/sounds', icon: Volume2, key: 'sounds' },
  { to: '/holidays', icon: CalendarOff, key: 'holidays' },
  { to: '/reports', icon: FileBarChart2, key: 'reports' },
  { to: '/backup', icon: DatabaseBackup, key: 'backup' },
  { to: '/settings', icon: SettingsIcon, key: 'settings' },
  { to: '/support', icon: LifeBuoy, key: 'support' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 transition-all ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="bg-primary-600 text-white rounded-xl p-2">
          <BellRing size={20} />
        </div>
        {!collapsed && <span className="font-bold text-lg">OpenBell</span>}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={key}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{t(`nav.${key}`)}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-400">{!collapsed && 'OpenBell v1.9.0'}</div>
    </aside>
  );
}

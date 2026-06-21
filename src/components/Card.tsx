import type { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'primary' | 'green' | 'amber' | 'rose';
}

const accentMap: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function StatCard({ title, value, icon: Icon, accent = 'primary' }: CardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`rounded-xl p-3 ${accentMap[accent]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

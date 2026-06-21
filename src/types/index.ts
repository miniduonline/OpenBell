export interface Schedule {
  id: number;
  title: string;
  day_of_week: number; // 0=Sun..6=Sat
  ring_time: string; // HH:MM
  sound_id: number | null;
  category: 'class' | 'break' | 'assembly' | 'exam' | 'custom';
  is_active: 0 | 1;
  repeat_weekly: 0 | 1;
  sort_order: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sound {
  id: number;
  name: string;
  file_path: string;
  duration_sec: number;
  volume: number;
  is_default: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  title: string;
  date: string;
  end_date?: string | null;
  type: 'school' | 'public' | 'exception';
  description?: string | null;
  created_at: string;
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'system' | 'bell' | 'schedule' | 'backup' | 'auth';
  message: string;
  meta?: string | null;
  schedule_id?: number | null;
  created_at: string;
}

export interface BackupRecord {
  id: number;
  file_path: string;
  size_bytes: number;
  type: 'manual' | 'automatic';
  status: 'success' | 'failed';
  created_at: string;
}

export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'si' | 'ta';

declare global {
  interface Window {
    openbell: import('../../electron/preload').OpenBellAPI;
  }
}

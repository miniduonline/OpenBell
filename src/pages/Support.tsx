import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Globe, User, BellRing, Copy, Check, Keyboard, RefreshCw, ExternalLink } from 'lucide-react';
import {
  checkForUpdates,
  getLastCheckedAt,
  type UpdateCheckOutcome,
} from '@/utils/updateChecker';

const DEVELOPER_NAME = 'Minidu Shashimal Aluthge';
const SUPPORT_EMAIL = 'info@minidu.lk';
const WEBSITE = 'minidu.lk';
const WEBSITE_URL = 'https://minidu.lk';

export default function Support() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('1.9.0');
  const [copied, setCopied] = useState<'email' | null>(null);
  const [checkResult, setCheckResult] = useState<UpdateCheckOutcome | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    window.openbell?.getVersion().then(setAppVersion);
    setLastChecked(getLastCheckedAt());
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setCheckResult(null);
    const outcome = await checkForUpdates();
    setCheckResult(outcome);
    setLastChecked(getLastCheckedAt());
    setChecking(false);
  };

  const copyEmail = () => {
    window.openbell.copyToClipboard(SUPPORT_EMAIL);
    setCopied('email');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('nav.support')}</h1>

      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 text-white rounded-xl p-3">
            <BellRing size={22} />
          </div>
          <div>
            <h2 className="font-semibold text-lg">OpenBell</h2>
            <p className="text-xs text-slate-400">{t('support.versionLabel', { version: appVersion })}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.intro')}</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <RefreshCw size={18} className="text-primary-600" /> {t('support.updatesTitle')}
        </h2>
        <p className="text-xs text-slate-400">
          {lastChecked
            ? t('support.lastChecked', { time: lastChecked.toLocaleString() })
            : t('support.neverChecked')}
        </p>

        <button className="btn-secondary flex items-center gap-2" onClick={handleCheckForUpdates} disabled={checking}>
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? t('support.checking') : t('support.checkForUpdates')}
        </button>

        {checkResult?.status === 'up-to-date' && (
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <Check size={14} /> {t('support.upToDate', { version: checkResult.data.currentVersion })}
          </p>
        )}

        {checkResult?.status === 'update-available' && (
          <div className="rounded-lg bg-primary-50 dark:bg-primary-900/30 p-3 space-y-2">
            <p className="text-sm font-medium">
              {t('support.newVersionFound', { version: checkResult.data.latestVersion })}
            </p>
            {checkResult.data.releaseNotes && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{checkResult.data.releaseNotes}</p>
            )}
            <button
              className="text-sm text-primary-600 underline flex items-center gap-1"
              onClick={() => window.openbell.openExternal(checkResult.data.releaseUrl)}
            >
              {t('update.viewRelease')} <ExternalLink size={12} />
            </button>
          </div>
        )}

        {checkResult?.status === 'error' && (
          <p className="text-sm text-rose-500">{checkResult.message}</p>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('support.developer')}</h2>

        <div className="flex items-center gap-3 text-sm">
          <User size={18} className="text-primary-600 shrink-0" />
          <span className="font-medium">{DEVELOPER_NAME}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Mail size={18} className="text-primary-600 shrink-0" />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          <button
            onClick={copyEmail}
            className="btn-secondary px-2 py-1 text-xs flex items-center gap-1"
            title={t('support.copyEmail')}
          >
            {copied === 'email' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Globe size={18} className="text-primary-600 shrink-0" />
          <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
            {WEBSITE}
          </a>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Keyboard size={18} className="text-primary-600" /> {t('support.shortcutsTitle')}
        </h2>
        <p className="text-xs text-slate-400">{t('support.shortcutsDesc')}</p>
        <div className="space-y-2 text-sm">
          {[
            ['Ctrl + N', 'support.shortcutNewSchedule'],
            ['Ctrl + S', 'support.shortcutSave'],
            ['Esc', 'support.shortcutEsc'],
          ].map(([keys, key]) => (
            <div key={keys} className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t(key)}</span>
              <kbd className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{keys}</kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">{t('support.shortcutsScope')}</p>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">{t('support.helpTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.helpBody')}</p>
      </div>

      <p className="text-xs text-slate-400">{t('support.footer', { name: DEVELOPER_NAME })}</p>
    </div>
  );
}

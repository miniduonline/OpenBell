import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Globe, User, BellRing, Copy, Check, Keyboard } from 'lucide-react';

const DEVELOPER_NAME = 'Minidu Shashimal Aluthge';
const SUPPORT_EMAIL = 'info@minidu.lk';
const WEBSITE = 'minidu.lk';
const WEBSITE_URL = 'https://minidu.lk';

export default function Support() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('1.9.0');
  const [copied, setCopied] = useState<'email' | null>(null);

  useEffect(() => {
    window.openbell?.getVersion().then(setAppVersion);
  }, []);

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

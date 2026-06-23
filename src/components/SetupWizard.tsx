import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, ChevronRight, ShieldCheck, Copy } from 'lucide-react';
import { useAppStore } from '@/store/useStore';
import { TIMEZONES } from '@/utils/timezones';
import type { Language } from '@/types';

interface SetupWizardProps {
  onComplete: () => void;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'si', label: 'සිංහල' },
  { value: 'ta', label: 'தமிழ்' },
];

/**
 * Shown exactly once, the very first time OpenBell is opened on a PC
 * (gated behind the 'setup_completed' setting - see App.tsx). Walks a
 * new user through the handful of settings that actually matter before
 * they start adding bells, instead of dropping them straight into a
 * blank Dashboard and a Settings page full of unfamiliar options.
 */
export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useAppStore();

  const [step, setStep] = useState(0);
  const [schoolName, setSchoolName] = useState('');
  const [language, setLocalLanguage] = useState<Language>('en');
  const [timezone, setTimezone] = useState('Asia/Colombo');
  const [wantsPassword, setWantsPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalSteps = 4; // welcome+name, language, timezone, password

  const applyLanguage = (lng: Language) => {
    setLocalLanguage(lng);
    setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  const finishWithPassword = async () => {
    if (password.length < 4) {
      setPasswordError(t('wizard.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t('wizard.passwordMismatch'));
      return;
    }
    setPasswordError('');
    setSaving(true);
    const result = await window.openbell.authSetPassword(password);
    setRecoveryCode(result.recoveryCode ?? null);
    setSaving(false);
  };

  const saveAndFinish = async () => {
    setSaving(true);
    const settingsToSave: [string, string][] = [
      ['school_name', schoolName.trim() || 'My School'],
      ['timezone', timezone],
      ['setup_completed', 'true'],
    ];
    for (const [key, value] of settingsToSave) {
      await window.openbell.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [key, value]
      );
    }
    setSaving(false);
    onComplete();
  };

  const copyRecoveryCode = () => {
    if (!recoveryCode) return;
    window.openbell.copyToClipboard(recoveryCode);
    setRecoveryCopied(true);
    setTimeout(() => setRecoveryCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 justify-center">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-primary-500' : i < step ? 'w-4 bg-primary-300' : 'w-4 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome + school name */}
        {step === 0 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <BellRing size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">{t('wizard.welcomeTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('wizard.welcomeDesc')}</p>
            <input
              type="text"
              className="input-field text-center"
              placeholder={t('wizard.schoolNamePlaceholder')}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              autoFocus
            />
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setStep(1)}>
              {t('wizard.continue')} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 1: Language */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-center">{t('wizard.languageTitle')}</h2>
            <div className="space-y-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => applyLanguage(l.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border flex items-center justify-between ${
                    language === l.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {l.label}
                  {language === l.value && <Check size={16} className="text-primary-600" />}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setStep(2)}>
              {t('wizard.continue')} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Timezone */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-center">{t('wizard.timezoneTitle')}</h2>
            <p className="text-xs text-slate-400 text-center">{t('wizard.timezoneDesc')}</p>
            <select className="input-field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setStep(3)}>
              {t('wizard.continue')} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 3: Optional password */}
        {step === 3 && (
          <div className="space-y-4">
            {wantsPassword === null && (
              <>
                <div className="text-center">
                  <ShieldCheck size={28} className="mx-auto text-primary-600 mb-2" />
                  <h2 className="text-lg font-semibold">{t('wizard.passwordTitle')}</h2>
                  <p className="text-xs text-slate-400 mt-1">{t('wizard.passwordDesc')}</p>
                </div>
                <button className="btn-primary w-full" onClick={() => setWantsPassword(true)}>
                  {t('wizard.passwordSetUp')}
                </button>
                <button className="btn-secondary w-full" onClick={saveAndFinish} disabled={saving}>
                  {t('wizard.passwordSkip')}
                </button>
              </>
            )}

            {wantsPassword === true && !recoveryCode && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-center">{t('wizard.passwordSetUp')}</h2>
                <input
                  type="password"
                  className="input-field"
                  placeholder={t('wizard.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="input-field"
                  placeholder={t('wizard.passwordConfirmPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {passwordError && <p className="text-sm text-rose-500">{passwordError}</p>}
                <button className="btn-primary w-full" onClick={finishWithPassword} disabled={saving}>
                  {t('wizard.continue')}
                </button>
                <button className="btn-secondary w-full" onClick={() => setWantsPassword(null)}>
                  {t('common.back')}
                </button>
              </div>
            )}

            {recoveryCode && (
              <div className="space-y-3">
                <div className="text-center">
                  <ShieldCheck size={28} className="mx-auto text-emerald-600 mb-2" />
                  <h2 className="text-lg font-semibold">{t('wizard.recoveryTitle')}</h2>
                  <p className="text-xs text-slate-400 mt-1">{t('wizard.recoveryDesc')}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                  <code className="flex-1 font-mono text-sm">{recoveryCode}</code>
                  <button onClick={copyRecoveryCode} className="text-slate-400 hover:text-slate-600">
                    {recoveryCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
                <button className="btn-primary w-full" onClick={saveAndFinish} disabled={saving}>
                  {t('wizard.finish')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

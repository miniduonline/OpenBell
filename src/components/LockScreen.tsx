import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, KeyRound, AlertCircle } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
}

/**
 * Full-screen gate shown on launch when password protection is enabled.
 * Also offers a "forgot password" flow using the one-time recovery code
 * generated when the password was first set — no internet/e-mail needed,
 * which matters since the bell PC is typically offline.
 */
export default function LockScreen({ onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Recovery flow state
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const ok = await window.openbell.authVerify(password);
      if (ok) {
        onUnlock();
      } else {
        setError(t('lock.incorrectPassword'));
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 4) {
      setError(t('lock.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('lock.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const result = await window.openbell.authResetWithRecoveryCode(recoveryCode, newPassword);
      if (result.success) {
        setNewRecoveryCode(result.recoveryCode);
      } else {
        setError(t('lock.invalidRecoveryCode'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm card space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600">
            <Lock size={22} />
          </div>
          <h1 className="text-lg font-bold">{t('lock.title')}</h1>
          <p className="text-sm text-slate-500">
            {mode === 'login'
              ? t('lock.enterPasswordPrompt')
              : newRecoveryCode
                ? t('lock.resetSuccess')
                : t('lock.enterRecoveryPrompt')}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={submitLogin} className="space-y-3">
            <input
              type="password"
              autoFocus
              className="input-field"
              placeholder={t('lock.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={busy || !password} className="btn-primary w-full">
              {busy ? t('lock.checking') : t('lock.unlock')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recover');
                setError('');
              }}
              className="w-full text-xs text-slate-400 hover:text-primary-600 flex items-center justify-center gap-1"
            >
              <KeyRound size={12} /> {t('lock.forgotPassword')}
            </button>
          </form>
        )}

        {mode === 'recover' && !newRecoveryCode && (
          <form onSubmit={submitRecovery} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">{t('lock.recoveryCode')}</label>
              <input
                type="text"
                autoFocus
                className="input-field uppercase tracking-wider"
                placeholder="XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('lock.newPassword')}</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('lock.confirmNewPassword')}</label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={busy || !recoveryCode || !newPassword} className="btn-primary w-full">
              {busy ? t('lock.resetting') : t('lock.resetPassword')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className="w-full text-xs text-slate-400 hover:text-primary-600"
            >
              {t('lock.backToLogin')}
            </button>
          </form>
        )}

        {mode === 'recover' && newRecoveryCode && (
          <div className="space-y-3">
            <p className="text-sm">
              {t('lock.recoveryCodeNoticePart1')} <strong>{t('lock.recoveryCodeNoticeNew')}</strong> {t('lock.recoveryCodeNoticePart2')}
            </p>
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-center font-mono text-base tracking-wider select-all">
              {newRecoveryCode}
            </div>
            <button type="button" onClick={onUnlock} className="btn-primary w-full">
              {t('lock.continueToApp')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

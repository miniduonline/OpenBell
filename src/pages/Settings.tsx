import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useStore';
import { Check, Copy, ShieldCheck, ShieldOff, ExternalLink, Trash2, Network, RefreshCw } from 'lucide-react';
import type { Language } from '@/types';

// Page shown when the user clicks "Check for Updates". OpenBell no longer
// auto-downloads/auto-installs updates in-app (see v1.9.0 changelog) - the
// button simply opens the GitHub releases page in the system browser so the
// user can see what's new and grab the installer manually if they want it.
const UPDATE_CHECK_URL = 'https://github.com/miniduonline/OpenBell/releases';

const TIMEZONES = [
  { value: 'Asia/Colombo', label: 'Asia/Colombo — Sri Lanka (default)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata — India' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka — Bangladesh' },
  { value: 'Asia/Kathmandu', label: 'Asia/Kathmandu — Nepal' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi — Pakistan' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai — UAE' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala Lumpur — Malaysia' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok — Thailand' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo — Japan' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai — China' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong' },
  { value: 'Europe/London', label: 'Europe/London — UK' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'America/New_York', label: 'America/New York — US East' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles — US West' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
  { value: 'UTC', label: 'UTC' },
];

interface SettingRow {
  key: string;
  value: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useAppStore();

  // ---- Startup with OS ---------------------------------------------------
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupLoaded, setStartupLoaded] = useState(false);

  useEffect(() => {
    window.openbell?.getLoginItem().then((enabled) => {
      setStartupEnabled(enabled);
      setStartupLoaded(true);
    });
  }, []);

  const toggleStartup = async (enabled: boolean) => {
    setStartupEnabled(enabled); // optimistic UI
    const actual = await window.openbell.setLoginItem(enabled);
    setStartupEnabled(actual); // reconcile with what the OS actually accepted
  };

  // ---- Timezone -----------------------------------------------------------------
  const [timezone, setTimezoneState] = useState('Asia/Colombo');
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    window.openbell
      ?.get<SettingRow>('SELECT value FROM settings WHERE key = ?', ['timezone'])
      .then((row) => row?.value && setTimezoneState(row.value));
  }, []);

  const saveGeneralSettings = async () => {
    await window.openbell.run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('timezone', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [timezone]
    );
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  // ---- Sound output device -------------------------------------------------------
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDeviceId, setOutputDeviceId] = useState('default');
  const [outputDeviceLoaded, setOutputDeviceLoaded] = useState(false);
  const [outputSavedMsg, setOutputSavedMsg] = useState(false);

  useEffect(() => {
    // Load the previously-saved device, and the live list of devices
    // currently available on this PC. We request mic permission first
    // (silently auto-approved in main.ts) purely so Chromium gives us real
    // device names instead of blank ones - OpenBell never records audio.
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
      } catch (err) {
        console.error('[OpenBell] Could not list audio output devices:', err);
      }

      const row = await window.openbell?.get<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        ['audio_output_device']
      );
      if (row?.value) setOutputDeviceId(row.value);
      setOutputDeviceLoaded(true);
    })();
  }, []);

  const saveOutputDevice = async (deviceId: string) => {
    setOutputDeviceId(deviceId);
    await window.openbell.run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('audio_output_device', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [deviceId]
    );
    setOutputSavedMsg(true);
    setTimeout(() => setOutputSavedMsg(false), 2000);
  };

  // ---- LAN Sync (Multi-PC, no internet needed) ------------------------------------
  type LanMode = 'off' | 'host' | 'client';
  const [lanMode, setLanMode] = useState<LanMode>('off');
  const [lanLoaded, setLanLoaded] = useState(false);
  const [hostIpInput, setHostIpInput] = useState('');
  const [thisIp, setThisIp] = useState<string | null>(null);
  const [lanBusy, setLanBusy] = useState(false);
  const [lanTestResult, setLanTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [lanSyncResult, setLanSyncResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const modeRow = await window.openbell?.get<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        ['lan_sync_mode']
      );
      const ipRow = await window.openbell?.get<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        ['lan_sync_host_ip']
      );
      if (modeRow?.value) setLanMode(modeRow.value as LanMode);
      if (ipRow?.value) setHostIpInput(ipRow.value);
      const ip = await window.openbell?.lanGetLocalIp();
      setThisIp(ip ?? null);
      setLanLoaded(true);
    })();
  }, []);

  const saveLanSetting = async (key: string, value: string) => {
    await window.openbell.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value]
    );
  };

  const changeLanMode = async (mode: LanMode) => {
    setLanMode(mode);
    setLanTestResult('idle');
    setLanSyncResult(null);
    await saveLanSetting('lan_sync_mode', mode);

    if (mode === 'host') {
      await window.openbell.lanStopClientAutoSync();
      await window.openbell.lanStartHost();
    } else if (mode === 'client') {
      await window.openbell.lanStopHost();
      if (hostIpInput) {
        await window.openbell.lanStartClientAutoSync(hostIpInput, 5);
      }
    } else {
      await window.openbell.lanStopHost();
      await window.openbell.lanStopClientAutoSync();
    }
  };

  const saveHostIp = async (ip: string) => {
    setHostIpInput(ip);
    await saveLanSetting('lan_sync_host_ip', ip);
    if (lanMode === 'client' && ip) {
      await window.openbell.lanStartClientAutoSync(ip, 5);
    }
  };

  const testHostConnection = async () => {
    setLanBusy(true);
    setLanTestResult('idle');
    const ok = await window.openbell.lanTestConnection(hostIpInput);
    setLanTestResult(ok ? 'ok' : 'fail');
    setLanBusy(false);
  };

  const syncWithHostNow = async () => {
    setLanBusy(true);
    setLanSyncResult(null);
    try {
      const result = await window.openbell.lanSyncNow(hostIpInput);
      setLanSyncResult(
        t('settings.lanSyncSuccess', { schedules: result.schedules, holidays: result.holidays })
      );
    } catch (err) {
      setLanSyncResult(t('settings.lanSyncFailed'));
    }
    setLanBusy(false);
  };

  // ---- Password protection -------------------------------------------------------
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [pwLoaded, setPwLoaded] = useState(false);
  const [pwMode, setPwMode] = useState<'idle' | 'enable' | 'change' | 'disable'>('idle');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadPasswordState = () => {
    window.openbell?.authIsEnabled().then((enabled) => {
      setPasswordEnabled(enabled);
      setPwLoaded(true);
    });
  };
  useEffect(loadPasswordState, []);

  const resetPwForm = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwMode('idle');
  };

  const submitNewPassword = async () => {
    setPwError('');
    if (newPw.length < 4) {
      setPwError('Password must be at least 4 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match.');
      return;
    }
    const result = await window.openbell.authSetPassword(newPw);
    if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
    setPasswordEnabled(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwMode('idle');
  };

  const submitDisablePassword = async () => {
    setPwError('');
    const ok = await window.openbell.authDisable(currentPw);
    if (!ok) {
      setPwError('Incorrect current password.');
      return;
    }
    setPasswordEnabled(false);
    resetPwForm();
  };

  const copyRecoveryCode = () => {
    if (!recoveryCode) return;
    navigator.clipboard?.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const changeLanguage = (lng: Language) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  // ---- System maintenance: updates & full reset ----------------------------------
  const [resetting, setResetting] = useState(false);
  // Electron does not implement window.prompt() — it silently returns null
  // even though alert()/confirm() work fine. That made the password prompt
  // a no-op whenever password protection was enabled. We use a real in-app
  // modal here instead.
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPw, setResetPw] = useState('');
  const [resetPwError, setResetPwError] = useState('');

  // Opens the GitHub releases page in the system browser. No in-app
  // auto-updater anymore — this just lets the user check what the latest
  // version is and download it themselves if they want it.
  const handleCheckForUpdates = () => {
    window.openbell?.openExternal(UPDATE_CHECK_URL);
  };

  const performReset = async (password: string | null) => {
    setResetting(true);
    try {
      const result = await window.openbell.fullReset(password);
      if (result.success) {
        alert('✅ Database fully reset. Please restart OpenBell.');
      } else {
        alert('❌ ' + result.message);
      }
      return result;
    } catch (e) {
      alert('Reset failed');
      return null;
    } finally {
      setResetting(false);
    }
  };

  const handleFullReset = async () => {
    if (passwordEnabled) {
      // Open the in-app modal instead of window.prompt(), which Electron
      // never actually shows.
      setResetPw('');
      setResetPwError('');
      setResetModalOpen(true);
      return;
    }

    if (!confirm('⚠️ This will delete ALL data permanently. Are you sure?')) return;
    await performReset(null);
  };

  const submitResetModal = async () => {
    if (!resetPw) {
      setResetPwError('Please enter your password.');
      return;
    }
    if (!confirm('⚠️ This will delete ALL data permanently. Are you sure?')) return;

    const result = await performReset(resetPw);
    if (result?.success) {
      setResetModalOpen(false);
    } else if (result) {
      setResetPwError(result.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('nav.settings')}</h1>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.theme')}</h2>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium ${theme === 'light' ? 'bg-primary-600 text-white' : 'btn-secondary'}`}
            onClick={() => setTheme('light')}
          >
            {t('settings.light')}
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-primary-600 text-white' : 'btn-secondary'}`}
            onClick={() => setTheme('dark')}
          >
            {t('settings.dark')}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.language')}</h2>
        <select className="input-field" value={language} onChange={(e) => changeLanguage(e.target.value as Language)}>
          <option value="en">English</option>
          <option value="si">සිංහල (Sinhala)</option>
          <option value="ta">தமிழ் (Tamil)</option>
        </select>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.startup')}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={startupEnabled}
            disabled={!startupLoaded}
            onChange={(e) => toggleStartup(e.target.checked)}
          />
          {t('settings.startWithOS')}
        </label>
        <p className="text-xs text-slate-400">
          OpenBell will launch automatically in the background when Windows starts, so bells keep ringing even
          after a restart.
        </p>
        <p className="text-xs text-slate-400">{t('settings.closeToTray')}</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Timezone</h2>
        <p className="text-xs text-slate-400">
          Bells ring according to this timezone, regardless of what timezone the PC's clock is set to. Defaults to
          Sri Lanka time (Asia/Colombo).
        </p>
        <select className="input-field" value={timezone} onChange={(e) => setTimezoneState(e.target.value)}>
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={saveGeneralSettings}>
            {t('common.save')}
          </button>
          {savedMsg && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.outputDevice')}</h2>
        <p className="text-xs text-slate-400">{t('settings.outputDeviceDesc')}</p>
        <select
          className="input-field"
          value={outputDeviceId}
          disabled={!outputDeviceLoaded}
          onChange={(e) => saveOutputDevice(e.target.value)}
        >
          <option value="default">{t('settings.allOutputDevices')}</option>
          {outputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || t('settings.unnamedDevice')}
            </option>
          ))}
        </select>
        {outputSavedMsg && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Check size={14} /> Saved
          </span>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Network size={18} className={lanMode !== 'off' ? 'text-emerald-600' : 'text-slate-400'} />
          {t('settings.lanSync')}
        </h2>
        <p className="text-xs text-slate-400">{t('settings.lanSyncDesc')}</p>

        <div className="grid grid-cols-3 gap-2">
          {(['off', 'host', 'client'] as LanMode[]).map((mode) => (
            <button
              key={mode}
              disabled={!lanLoaded}
              onClick={() => changeLanMode(mode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                lanMode === mode
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              {t(`settings.lanMode_${mode}`)}
            </button>
          ))}
        </div>

        {lanMode === 'host' && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
            <p className="text-slate-500 dark:text-slate-400">{t('settings.lanHostHint')}</p>
            <p className="font-mono text-base font-semibold">
              {thisIp ?? t('settings.lanNoIp')}{' '}
              <span className="text-slate-400 text-sm">: 47811</span>
            </p>
          </div>
        )}

        {lanMode === 'client' && (
          <div className="space-y-3">
            <label className="text-xs text-slate-500 dark:text-slate-400">{t('settings.lanHostIpLabel')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="192.168.1.42"
                value={hostIpInput}
                onChange={(e) => setHostIpInput(e.target.value)}
                onBlur={(e) => saveHostIp(e.target.value)}
              />
              <button onClick={testHostConnection} disabled={lanBusy || !hostIpInput} className="btn-secondary">
                {t('settings.lanTestConnection')}
              </button>
            </div>
            {lanTestResult === 'ok' && (
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <Check size={14} /> {t('settings.lanConnectionOk')}
              </p>
            )}
            {lanTestResult === 'fail' && (
              <p className="text-sm text-rose-500">{t('settings.lanConnectionFailed')}</p>
            )}

            <button
              onClick={syncWithHostNow}
              disabled={lanBusy || !hostIpInput}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={14} className={lanBusy ? 'animate-spin' : ''} />
              {t('settings.lanSyncNow')}
            </button>
            {lanSyncResult && <p className="text-sm text-slate-500 dark:text-slate-400">{lanSyncResult}</p>}
            <p className="text-xs text-slate-400">{t('settings.lanAutoSyncNote')}</p>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          {passwordEnabled ? <ShieldCheck size={18} className="text-emerald-600" /> : <ShieldOff size={18} className="text-slate-400" />}
          Password Protection
        </h2>
        <p className="text-xs text-slate-400">
          When enabled, OpenBell asks for a password every time it starts (or when you tap the lock icon in the
          header). Useful so students or staff can't change bell schedules without permission.
        </p>

        {!pwLoaded ? null : (
          <>
            {recoveryCode && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">
                  Save this recovery code now — you'll need it if you ever forget your password. It will not be
                  shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 font-mono text-base tracking-wider flex-1 text-center select-all">
                    {recoveryCode}
                  </code>
                  <button onClick={copyRecoveryCode} className="btn-secondary px-3 py-2" title="Copy">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <button className="text-xs text-slate-500 hover:text-primary-600" onClick={() => setRecoveryCode(null)}>
                  I've saved it, dismiss
                </button>
              </div>
            )}

            {pwMode === 'idle' && (
              <div className="flex gap-2">
                {!passwordEnabled ? (
                  <button className="btn-primary" onClick={() => setPwMode('enable')}>
                    Enable Password Protection
                  </button>
                ) : (
                  <>
                    <button className="btn-secondary" onClick={() => setPwMode('change')}>
                      Change Password
                    </button>
                    <button className="btn-secondary text-rose-600" onClick={() => setPwMode('disable')}>
                      Disable Password Protection
                    </button>
                  </>
                )}
              </div>
            )}

            {(pwMode === 'enable' || pwMode === 'change') && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">New password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Confirm new password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </div>
                {pwError && <p className="text-sm text-rose-600">{pwError}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={submitNewPassword}>
                    {t('common.save')}
                  </button>
                  <button className="btn-secondary" onClick={resetPwForm}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {pwMode === 'disable' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Current password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                  />
                </div>
                {pwError && <p className="text-sm text-rose-600">{pwError}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={submitDisablePassword}>
                    Confirm Disable
                  </button>
                  <button className="btn-secondary" onClick={resetPwForm}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Forgot the password later? On the lock screen, tap "Forgot password?" and enter the recovery code
              shown above to set a new one.
            </p>
          </>
        )}
      </div>

      {/* New v1.2.0 Features */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">System Maintenance</h2>
        <p className="text-xs text-slate-400">Updates and full data reset</p>

        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={handleCheckForUpdates}>
            <ExternalLink size={16} />
            Check for Updates
          </button>

          <button
            className="btn-secondary text-rose-600 flex items-center gap-2"
            disabled={resetting}
            onClick={handleFullReset}
          >
            <Trash2 size={16} />
            {resetting ? 'Resetting...' : 'Full Database Reset'}
          </button>
        </div>
      </div>

      {/* Rendered via a portal straight onto <body>, instead of in place here.
          The header bar uses its own `sticky` + `backdrop-blur`, which puts it
          in a separate compositing layer from this modal's flex/main
          ancestry. With the modal-mounted in place, the header's blur layer
          sat in front of this overlay's backdrop-blur in some Chromium
          versions, so the header stayed sharp while everything else behind
          the dialog blurred (the bug this fixes). Portal-ing the modal to
          the very end of <body> makes it a true top-level sibling instead of
          a nested descendant, so it composites above *everything* — header
          included — and the blur applies uniformly. */}
      {resetModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="card max-w-sm w-full space-y-3 bg-white dark:bg-slate-800 shadow-2xl">
            <h3 className="font-semibold text-rose-600 flex items-center gap-2">
              <Trash2 size={18} />
              Confirm Full Database Reset
            </h3>
            <p className="text-xs text-slate-400">
              This deletes ALL schedules, sounds, holidays, logs, and your password permanently. Enter your
              password to continue.
            </p>
            <div>
              <label className="text-xs text-slate-400">Current password</label>
              <input
                type="password"
                autoFocus
                className="input-field"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitResetModal()}
              />
            </div>
            {resetPwError && <p className="text-sm text-rose-600">{resetPwError}</p>}
            <div className="flex gap-2">
              <button className="btn-primary bg-rose-600" disabled={resetting} onClick={submitResetModal}>
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
              <button className="btn-secondary" onClick={() => setResetModalOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

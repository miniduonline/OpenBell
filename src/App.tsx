import { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import LockScreen from '@/components/LockScreen';
import SetupWizard from '@/components/SetupWizard';
import Dashboard from '@/pages/Dashboard';
import Schedules from '@/pages/Schedules';
import Sounds from '@/pages/Sounds';
import Holidays from '@/pages/Holidays';
import Reports from '@/pages/Reports';
import Backup from '@/pages/Backup';
import Settings from '@/pages/Settings';
import Support from '@/pages/Support';
import { useTheme } from '@/hooks/useTheme';

export default function App() {
  useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; url: string } | null>(null);

  // Once a day, check GitHub Releases for a newer version than what's
  // currently installed. This is a plain read-only GET request to a
  // public API endpoint - no telemetry, no accounts, nothing is sent
  // about this PC or school. If there's no internet, this just silently
  // does nothing (fails quietly, never blocks the app from working).
  useEffect(() => {
    if (!window.openbell) return;

    const dismissedVersion = localStorage.getItem('openbell-update-dismissed');
    const lastCheck = Number(localStorage.getItem('openbell-update-lastcheck') ?? '0');
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastCheck < oneDayMs) return;

    (async () => {
      try {
        const currentVersion = await window.openbell.getVersion();
        const res = await fetch('https://api.github.com/repos/miniduonline/OpenBell/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const latestVersion = String(data.tag_name ?? '').replace(/^v/, '');
        if (!latestVersion) return;

        localStorage.setItem('openbell-update-lastcheck', String(Date.now()));

        const isNewer = (a: string, b: string) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
            if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
          }
          return false;
        };

        if (isNewer(latestVersion, currentVersion) && latestVersion !== dismissedVersion) {
          setUpdateAvailable({ version: latestVersion, url: data.html_url ?? '' });
        }
      } catch {
        // No internet, or GitHub unreachable - just stay quiet.
      }
    })();
  }, []);

  const dismissUpdate = () => {
    if (updateAvailable) {
      localStorage.setItem('openbell-update-dismissed', updateAvailable.version);
    }
    setUpdateAvailable(null);
  };

  // First-run check: has this PC's OpenBell ever finished the setup
  // wizard? If not, we show it before anything else (including the lock
  // screen) so a brand new install doesn't drop someone into a blank
  // Dashboard with nothing configured.
  useEffect(() => {
    if (!window.openbell) {
      setSetupChecked(true);
      return;
    }
    (async () => {
      const row = await window.openbell.get<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        ['setup_completed']
      );
      if (row?.value === 'true') {
        setSetupCompleted(true);
      } else {
        // Existing installs upgrading from a version before this wizard
        // existed will have schedules already configured - don't show
        // the wizard to them, just silently mark setup as done.
        const existing = await window.openbell.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM schedules'
        );
        if ((existing?.count ?? 0) > 0) {
          await window.openbell.run(
            `INSERT INTO settings (key, value, updated_at) VALUES ('setup_completed', 'true', datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
          );
          setSetupCompleted(true);
        } else {
          setSetupCompleted(false);
        }
      }
      setSetupChecked(true);
    })();
  }, []);
  const [healthAlert, setHealthAlert] = useState<{ title: string; ringTime: string; reason: string } | null>(
    null
  );

  // Listen for silent-bell-failure alerts pushed from the main process
  // (see electron/services/bellHealthMonitor.ts). This is a second,
  // belt-and-suspenders notice on top of the native OS notification -
  // it stays visible in-app even if the OS toast gets missed/dismissed.
  useEffect(() => {
    if (!window.openbell) return;
    window.openbell.onBellHealthAlert((data) => {
      setHealthAlert(data);
    });
  }, []);

  // On launch, check whether password protection is turned on and gate
  // access behind the lock screen if so. The unlocked state lives only in
  // memory for this session — closing and reopening the app re-locks it.
  useEffect(() => {
    if (!window.openbell) {
      setAuthReady(true);
      return;
    }
    window.openbell
      .authIsEnabled()
      .then((enabled) => setLocked(enabled))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!window.openbell) return;

    window.openbell.onBellPlay(async ({ requestId, filePath, volume }) => {
      const confirm = (success: boolean, errorMessage?: string) => {
        // Only scheduled bells carry a requestId (sound previews from the
        // Sounds page don't) - the main process's health monitor is only
        // tracking actual scheduled rings, so there's nothing to confirm
        // back for a preview.
        if (requestId) {
          window.openbell.confirmBellPlay(requestId, success, errorMessage).catch(() => {});
        }
      };

      try {
        // Read the audio file via the main process.
        // This avoids the file:// cross-origin block that Electron enforces
        // when the renderer is served from http://localhost:5173 in dev mode.
        const buffer: Buffer | null = await window.openbell.getAudioBuffer(filePath);

        if (!buffer) {
          console.error('[OpenBell] Audio file could not be read:', filePath);
          confirm(false, 'Audio file could not be read from disk');
          return;
        }

        // Determine MIME type from file extension
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const mime =
          ext === 'wav' ? 'audio/wav'
          : ext === 'ogg' ? 'audio/ogg'
          : 'audio/mpeg'; // default: mp3

        // Create a Blob URL — Blob URLs are treated as same-origin and are
        // never blocked by Electron's cross-origin or autoplay restrictions.
const blob = new Blob([new Uint8Array(buffer)], { type: mime });
        const url = URL.createObjectURL(blob);

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        // Route playback to whichever output device the user picked on the
        // Settings page (stored as the 'audio_output_device' setting). If
        // none was picked, or the saved device no longer exists (e.g. USB
        // speaker unplugged), this falls back to the system default output.
        try {
          const deviceRow = await window.openbell.get<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['audio_output_device']
          );
          const deviceId = deviceRow?.value;
          const anyAudio = audioRef.current as HTMLAudioElement & {
            setSinkId?: (id: string) => Promise<void>;
          };
          if (deviceId && deviceId !== 'default' && typeof anyAudio.setSinkId === 'function') {
            await anyAudio.setSinkId(deviceId);
          }
        } catch (err) {
          // If the saved device is no longer available, just play on the
          // default device instead of failing the bell entirely.
          console.error('[OpenBell] Could not switch to saved output device:', err);
        }

        // Stop any sound that is currently playing
        audioRef.current.pause();
        audioRef.current.currentTime = 0;

        audioRef.current.src = url;
        // volume from DB is 0-100. A *linear* mapping straight to
        // HTMLAudioElement.volume (0.0-1.0) is what the slider used to do,
        // but human hearing perceives loudness roughly logarithmically —
        // so a linear gain makes most of the slider's upper range (50-100%)
        // sound almost identical, while everything below ~20% feels like an
        // abrupt mute. That's the "volume bar doesn't work properly" bug.
        // Applying a cubic taper makes the slider sound linear to the ear.
        const pct = Math.min(Math.max(volume, 0), 100) / 100;
        audioRef.current.volume = Math.pow(pct, 3);

        // Release the Blob URL after playback so we don't leak memory
        audioRef.current.onended = () => URL.revokeObjectURL(url);

        // If the audio engine itself reports an error partway through
        // (corrupt file, codec issue) after we already confirmed success,
        // there's nothing more useful we can do than log it - the bell
        // did start, just didn't finish cleanly. We still confirm success
        // based on play() resolving below, which is the moment that
        // matters for "did the bell actually make sound".
        audioRef.current.onerror = () => {
          console.error('[OpenBell] Audio element reported an error after starting:', filePath);
        };

        await audioRef.current.play();
        confirm(true);
      } catch (err) {
        console.error('[OpenBell] Audio playback failed:', err, '| Path:', filePath);
        confirm(false, err instanceof Error ? err.message : String(err));
      }
    });
  }, []);

  if (!authReady || !setupChecked) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;
  }

  if (!setupCompleted) {
    return <SetupWizard onComplete={() => setSetupCompleted(true)} />;
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          {updateAvailable && (
            <div className="bg-primary-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-3">
              <span>
                🎉 OpenBell v{updateAvailable.version} is available.{' '}
                <button
                  className="underline font-medium"
                  onClick={() => window.openbell.openExternal(updateAvailable.url)}
                >
                  View release
                </button>
              </span>
              <button onClick={dismissUpdate} className="opacity-80 hover:opacity-100 px-2">
                ✕
              </button>
            </div>
          )}
          {healthAlert && (
            <div className="bg-rose-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-3">
              <span>
                ⚠️ <strong>{healthAlert.title}</strong> did not ring at {healthAlert.ringTime} —{' '}
                {healthAlert.reason}
              </span>
              <button onClick={() => setHealthAlert(null)} className="opacity-80 hover:opacity-100 px-2">
                ✕
              </button>
            </div>
          )}
          <Header onLock={() => setLocked(true)} />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/sounds" element={<Sounds />} />
              <Route path="/holidays" element={<Holidays />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/support" element={<Support />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

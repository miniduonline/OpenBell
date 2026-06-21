import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDb, closeDatabase } from './database/db';
import { startScheduler, stopScheduler } from './services/scheduler';
import { createBackup, restoreBackup, scheduleAutoBackup } from './services/backupService';
import { previewSound } from './services/audioPlayer';
import { writeLog } from './services/logger';
import {
  isPasswordEnabled,
  verifyPassword,
  setPassword,
  disablePassword,
  resetPasswordWithRecoveryCode,
} from './services/auth';

// Allow audio autoplay without a prior user gesture (needed for scheduled bells)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Set the app name shown in Windows notifications to "OpenBell" instead of
// the default "electron.app.OpenBell" that Electron uses before packaging.
app.setName('OpenBell');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.openbell.app');
}

// ---- Single-instance lock ---------------------------------------------------
// Prevent a second copy of OpenBell from launching (e.g. clicking the desktop
// shortcut while the app is already running hidden in the tray). Without this
// lock each click creates a brand-new BrowserWindow, which is what caused the
// "Settings opens a second window" bug reported in v1.6.0.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running — quit immediately so the existing
  // instance handles everything.
  app.quit();
}

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// Set to true only when the user explicitly chooses "Quit OpenBell" from the
// tray menu (or the OS is shutting every app down). Until then, closing the
// main window just hides it - the scheduler/tray keep running in the
// background so bells keep ringing even with no window open.
let isQuitting = false;
let hasShownTrayHint = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
  icon: path.join(__dirname, '../build/icon.ico'), 

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // In dev mode the renderer runs on http://localhost:5173, which would
      // normally block loading file:// resources.  We bypass that here by
      // serving the audio bytes through IPC instead, but webSecurity: false
      // is kept as an extra safety net for any other local-file access.
      webSecurity: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Uncomment the line below to open DevTools automatically while debugging:
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // ---- Block new windows / handle external links ----------------------------
  // Without this handler, <a target="_blank"> links (e.g. the developer
  // website on the Support page) open a new Electron BrowserWindow that
  // loads the full OpenBell UI instead of opening the browser.
  // We intercept every window-open request: external http(s) URLs go to the
  // system default browser via shell.openExternal(); everything else is
  // denied so no rogue popup windows can appear.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent in-page navigation from accidentally leaving the app (e.g. if
  // any code calls location.href with an external URL).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://`;
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
  });

  // Closing the window (the X button) should NOT exit the app - OpenBell is
  // a bell-ringing scheduler, so it needs to keep running in the background
  // (and in the system tray) even when nobody has the window open. Real
  // quitting only happens via the tray menu's "Quit OpenBell", which sets
  // isQuitting = true before calling app.quit().
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (process.platform === 'win32' && tray && !hasShownTrayHint) {
        hasShownTrayHint = true;
        tray.displayBalloon({
          title: 'OpenBell is still running',
          content: 'OpenBell keeps running in the background so bells keep ringing. Right-click the tray icon to reopen or quit.',
          iconType: 'custom',
          icon: nativeImage.createFromPath(path.join(__dirname, '../build/icon.ico')),
          largeIcon: true,
          noSound: false,
        });
      }
    }
  });

  mainWindow.on('closed', () => (mainWindow = null));
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../build/icon.ico');
  let trayIcon = nativeImage.createFromPath(iconPath);
  // On Windows the tray expects a small icon; resize down if the source
  // image is larger so it renders crisply in the notification area.
  if (!trayIcon.isEmpty() && process.platform === 'win32') {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon.isEmpty() ? iconPath : trayIcon);
  tray.setToolTip('OpenBell - bell scheduler running in the background');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open OpenBell',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit OpenBell',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Single-click on Windows/Linux opens the window directly (the menu is
  // still reachable via right-click).
  tray.on('click', () => showMainWindow());
}

function registerIpcHandlers(): void {
  // ---- Generic table queries -------------------------------------------------
  ipcMain.handle('db:query', (_e, sql: string, params: unknown[] = []) => {
    const db = getDb();
    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('db:run', (_e, sql: string, params: unknown[] = []) => {
    const db = getDb();
    const result = db.prepare(sql).run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  });

  ipcMain.handle('db:get', (_e, sql: string, params: unknown[] = []) => {
    const db = getDb();
    return db.prepare(sql).get(...params);
  });

  // ---- Sounds -----------------------------------------------------------------
  ipcMain.handle('sounds:upload', async (_e, fileBuffer: ArrayBuffer, fileName: string) => {
    const soundsDir = path.join(app.getPath('userData'), 'sounds');
    if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
    const destPath = path.join(soundsDir, `${Date.now()}-${fileName}`);
    fs.writeFileSync(destPath, Buffer.from(fileBuffer));
    return destPath;
  });

  ipcMain.handle('sounds:preview', (_e, filePath: string, volume: number) => {
    previewSound(filePath, volume);
  });

  // Read audio file bytes and return them to the renderer so it can create a
  // Blob URL.  This sidesteps the file:// cross-origin block that occurs when
  // the renderer is served from http://localhost:5173 in dev mode.
  ipcMain.handle('sounds:getBuffer', (_e, filePath: string) => {
    try {
      return fs.readFileSync(filePath); // Buffer is cloned automatically by IPC
    } catch (err) {
      writeLog('error', 'bell', `Could not read audio file: ${filePath}`, { error: String(err) });
      return null;
    }
  });

  // ---- Backups ----------------------------------------------------------------
  ipcMain.handle('backup:create', () => createBackup('manual'));

  ipcMain.handle('backup:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select backup file',
      filters: [{ name: 'OpenBell Backup', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    restoreBackup(result.filePaths[0]);
    return result.filePaths[0];
  });

  // ---- Export dialogs -----------------------------------------------------------
  ipcMain.handle('export:saveFile', async (_e, defaultName: string, content: string) => {
    const result = await dialog.showSaveDialog({ defaultPath: defaultName });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  });

  // ---- App info -----------------------------------------------------------------
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Opens a URL in the user's default system browser. Used by the "Check for
  // Updates" button in Settings, which (since v1.9.0) just links out to the
  // GitHub releases page instead of using an in-app auto-updater.
  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle('app:getLoginItem', () => {
    // On Windows/macOS this reflects whatever was last set via
    // setLoginItemSettings (or, on Windows, whether the Startup shortcut
    // exists). Reading it back lets the UI show the real current state
    // instead of always starting unchecked.
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('app:setLoginItem', (_e, enabled: boolean) => {
    const settings: Electron.Settings = { openAtLogin: enabled };
    // electron-builder's NSIS installer launches via a Start Menu shortcut,
    // not the raw .exe, so on Windows we pin the exact exe path + args used
    // for the "run at login" registry entry. Without this, some installs
    // silently fail to actually start the app at login even though the
    // checkbox appears to save successfully.
    if (process.platform === 'win32') {
      settings.path = process.execPath;
      settings.args = [];
    }
    app.setLoginItemSettings(settings);
    writeLog('info', 'system', `Start-with-OS ${enabled ? 'enabled' : 'disabled'}`);
    return app.getLoginItemSettings().openAtLogin;
  });

  // ---- Password protection ------------------------------------------------------
  ipcMain.handle('auth:isEnabled', () => isPasswordEnabled());

  ipcMain.handle('auth:verify', (_e, password: string) => verifyPassword(password));

  ipcMain.handle('auth:setPassword', (_e, newPassword: string) => setPassword(newPassword));

  ipcMain.handle('auth:disable', (_e, currentPassword: string) => disablePassword(currentPassword));

  ipcMain.handle('auth:resetWithRecoveryCode', (_e, recoveryCode: string, newPassword: string) =>
    resetPasswordWithRecoveryCode(recoveryCode, newPassword)
  );

  // ---- Full Database Reset (v1.2.0) --------------------------------------------
  ipcMain.handle('db:fullReset', async (_e, password: string | null) => {
    // Only require/verify a password if password protection is actually
    // enabled. If the user never set a password, the reset proceeds
    // directly without prompting for one.
    if (isPasswordEnabled()) {
      if (!password || !verifyPassword(password)) {
        writeLog('warn', 'auth', 'Failed full reset attempt - wrong password');
        return { success: false, message: 'Incorrect password' };
      }
    }

    try {
      const db = getDb();

      // CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE in schema.sql are no-ops
      // on tables/rows that already exist, so simply re-running the schema
      // (the old approach) left every existing row — schedules, sounds,
      // holidays, logs, backups, even the password — completely untouched.
      // Explicitly wipe every table first so the app comes back looking
      // exactly like a brand-new install.
      db.exec(`
        DELETE FROM schedules;
        DELETE FROM sounds;
        DELETE FROM holidays;
        DELETE FROM logs;
        DELETE FROM backups;
        DELETE FROM settings;
      `);
      // sqlite_sequence only exists once an AUTOINCREMENT table has had a row
      // inserted, so guard this one separately rather than risk it failing
      // mid-way through the batch above.
      const hasSeqTable = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`)
        .get();
      if (hasSeqTable) {
        db.exec(`DELETE FROM sqlite_sequence;`);
      }

      // Re-run the schema to recreate tables (no-op, they already exist)
      // and reseed default settings — since the settings table is now
      // empty, this restores defaults and clears password/recovery code.
      const schemaPath = path.join(__dirname, 'database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);

      // Remove any uploaded sound files left on disk so they don't linger
      // as orphaned files after the database rows referencing them are gone.
      const soundsDir = path.join(app.getPath('userData'), 'sounds');
      if (fs.existsSync(soundsDir)) {
        for (const file of fs.readdirSync(soundsDir)) {
          try {
            fs.unlinkSync(path.join(soundsDir, file));
          } catch {
            // best-effort cleanup; ignore individual file failures
          }
        }
      }

      writeLog('info', 'system', 'Full database reset completed successfully');
      return { success: true, message: 'Database has been fully reset' };
    } catch (err) {
      writeLog('error', 'system', 'Full reset failed', { error: String(err) });
      return { success: false, message: 'Reset failed' };
    }
  });
}

/**
 * v1.2.0 migration — clears all scheduled bells and bell sounds from
 * databases that were created before this version.  The guard is a
 * 'db_version' row in the settings table; if it is absent (old DB) or
 * holds a version earlier than 1.2.0 we run the migration exactly once
 * and then stamp the new version.
 */
function runMigrations(): void {
  const db = getDb();

  const versionRow = db
    .prepare(`SELECT value FROM settings WHERE key = 'db_version'`)
    .get() as { value: string } | undefined;

  const currentVersion = versionRow?.value ?? '0.0.0';

  // Semantic-version compare: only run if the stored version is below 1.2.0
  const below120 = !currentVersion.match(/^1\.[2-9]/) && !currentVersion.match(/^[2-9]/);

  if (below120) {
    writeLog('info', 'system', `Running v1.2.0 migration (was ${currentVersion}): clearing schedules & sounds`);

    db.prepare('DELETE FROM schedules').run();
    db.prepare('DELETE FROM sounds').run();

    // Reset the auto-increment counters so IDs start fresh from 1
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('schedules', 'sounds')`).run();

    // Ensure timezone defaults to Sri Lanka
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('timezone', 'Asia/Colombo', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = 'Asia/Colombo', updated_at = datetime('now')`
    ).run();

    // Stamp the new version
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('db_version', '1.2.0', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '1.2.0', updated_at = datetime('now')`
    ).run();

    writeLog('info', 'system', 'v1.2.0 migration complete');
  }
}

app.whenReady().then(() => {
  // If the single-instance lock was not obtained, we already called app.quit()
  // above. But guard here too in case of any edge-case timing issue.
  if (!gotLock) return;

  // Auto-approve media permission requests (camera/mic) so that
  // navigator.mediaDevices.enumerateDevices() returns real device labels
  // (e.g. "Speakers (Realtek Audio)") instead of blank ones. OpenBell
  // never actually records anything - this is only needed so the
  // Settings page can show readable names when picking a sound output
  // device.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });

  initDatabase();
  runMigrations();
  registerIpcHandlers();
  startScheduler();
  scheduleAutoBackup(7);
  createWindow();
  createTray();

  writeLog('info', 'system', 'OpenBell application started v1.9.0');

  app.on('activate', () => {
    showMainWindow();
  });
});

// When a second instance tries to launch, the OS sends a signal to this
// (the first/primary) instance via the 'second-instance' event. We bring
// the existing window to the front instead of creating a new one.
app.on('second-instance', () => {
  showMainWindow();
});

// Closing the last window no longer quits the app - OpenBell keeps running
// in the system tray so scheduled bells keep ringing in the background.
// The app only exits via the tray's "Quit OpenBell" item or an OS shutdown,
// both of which set isQuitting = true before calling app.quit().
app.on('window-all-closed', () => {
  // Intentionally a no-op. Without this listener Electron's default
  // behaviour on Windows/Linux is to quit when the last window closes,
  // which would defeat the whole point of the tray/background mode.
});

app.on('before-quit', () => {
  isQuitting = true;
  stopScheduler();
  closeDatabase();
});

process.on('uncaughtException', (err) => {
  writeLog('error', 'system', 'Uncaught exception', { error: String(err) });
});

import { contextBridge, ipcRenderer } from 'electron';

export interface OpenBellAPI {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  get: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  run: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowid: number; changes: number }>;
  uploadSound: (fileBuffer: ArrayBuffer, fileName: string) => Promise<string>;
  previewSound: (filePath: string, volume: number) => Promise<void>;
  getAudioBuffer: (filePath: string) => Promise<Buffer | null>;
  createBackup: () => Promise<string>;
  restoreBackup: () => Promise<string | null>;
  saveFile: (defaultName: string, content: string) => Promise<string | null>;
  getVersion: () => Promise<string>;
  setLoginItem: (enabled: boolean) => Promise<boolean>;
  getLoginItem: () => Promise<boolean>;
  onBellPlay: (callback: (data: { filePath: string; volume: number }) => void) => void;
  authIsEnabled: () => Promise<boolean>;
  authVerify: (password: string) => Promise<boolean>;
  authSetPassword: (newPassword: string) => Promise<{ recoveryCode: string | null }>;
  authDisable: (currentPassword: string) => Promise<boolean>;
  authResetWithRecoveryCode: (
    recoveryCode: string,
    newPassword: string
  ) => Promise<{ success: boolean; recoveryCode: string | null }>;
  fullReset: (password: string | null) => Promise<{ success: boolean; message: string }>;
  openExternal: (url: string) => Promise<void>;
}

const api: OpenBellAPI = {
  query: (sql, params = []) => ipcRenderer.invoke('db:query', sql, params),
  get: (sql, params = []) => ipcRenderer.invoke('db:get', sql, params),
  run: (sql, params = []) => ipcRenderer.invoke('db:run', sql, params),
  uploadSound: (fileBuffer, fileName) => ipcRenderer.invoke('sounds:upload', fileBuffer, fileName),
  previewSound: (filePath, volume) => ipcRenderer.invoke('sounds:preview', filePath, volume),
  getAudioBuffer: (filePath) => ipcRenderer.invoke('sounds:getBuffer', filePath),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),
  saveFile: (defaultName, content) => ipcRenderer.invoke('export:saveFile', defaultName, content),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  setLoginItem: (enabled) => ipcRenderer.invoke('app:setLoginItem', enabled),
  getLoginItem: () => ipcRenderer.invoke('app:getLoginItem'),
  authIsEnabled: () => ipcRenderer.invoke('auth:isEnabled'),
  authVerify: (password) => ipcRenderer.invoke('auth:verify', password),
  authSetPassword: (newPassword) => ipcRenderer.invoke('auth:setPassword', newPassword),
  authDisable: (currentPassword) => ipcRenderer.invoke('auth:disable', currentPassword),
  authResetWithRecoveryCode: (recoveryCode, newPassword) =>
    ipcRenderer.invoke('auth:resetWithRecoveryCode', recoveryCode, newPassword),
  onBellPlay: (callback) => {
    // Remove any stale listeners before registering the new one so that
    // hot-reload / React strict-mode double-mount never stacks duplicates.
    ipcRenderer.removeAllListeners('bell:play');
    ipcRenderer.on('bell:play', (_event, data) => callback(data));
  },
  fullReset: (password) => ipcRenderer.invoke('db:fullReset', password),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
};

contextBridge.exposeInMainWorld('openbell', api);

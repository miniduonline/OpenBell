import crypto from 'crypto';
import { getDb } from '../database/db';
import { writeLog } from './logger';

/**
 * Password-protection service.
 *
 * The app only ever stores a salted hash of the password (scrypt, built
 * into Node.js — no extra native dependency needed). The plain password
 * itself is never written to disk or sent anywhere.
 *
 * Forgot-password flow: when a password is first set, a one-time
 * "Recovery Code" is generated and shown to the user exactly once. Only a
 * hash of that code is stored. If the password is forgotten, the user can
 * enter the recovery code on the lock screen to clear password protection
 * and set a new password — without needing internet access or e-mail,
 * which matters for an offline school PC.
 */

function getSetting(key: string): string {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? '';
}

function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value);
}

function hashWithSalt(plain: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(plain, salt, 64).toString('hex');
}

/** Generates a human-friendly recovery code, e.g. "7K2P-9XQ4-3MZT". */
function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) {
      group += chars[crypto.randomInt(chars.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

export function isPasswordEnabled(): boolean {
  return getSetting('password_enabled') === 'true';
}

export function verifyPassword(plain: string): boolean {
  const salt = getSetting('password_salt');
  const storedHash = getSetting('password_hash');
  if (!salt || !storedHash) return false;
  const computed = hashWithSalt(plain, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Sets (or changes) the password. If password protection was previously
 * disabled, this also generates and returns a brand-new recovery code that
 * the renderer must show the user once. If a password already existed and
 * is simply being changed, the existing recovery code is kept and `null`
 * is returned (no need to show it again).
 */
export function setPassword(newPlain: string): { recoveryCode: string | null } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashWithSalt(newPlain, salt);
  setSetting('password_salt', salt);
  setSetting('password_hash', hash);
  setSetting('password_enabled', 'true');

  const hadRecoveryCode = !!getSetting('recovery_code_hash');
  if (hadRecoveryCode) {
    writeLog('info', 'auth', 'Password changed');
    return { recoveryCode: null };
  }

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = crypto.randomBytes(16).toString('hex');
  const recoveryHash = hashWithSalt(recoveryCode, recoverySalt);
  setSetting('recovery_salt', recoverySalt);
  setSetting('recovery_code_hash', recoveryHash);
  writeLog('info', 'auth', 'Password protection enabled, recovery code generated');
  return { recoveryCode };
}

export function disablePassword(currentPlain: string): boolean {
  if (!verifyPassword(currentPlain)) return false;
  setSetting('password_enabled', 'false');
  setSetting('password_hash', '');
  setSetting('password_salt', '');
  writeLog('info', 'auth', 'Password protection disabled');
  return true;
}

/**
 * Resets a forgotten password using the recovery code. On success, the
 * recovery code itself is rotated (old one becomes invalid) along with the
 * new password, and the new code is returned so it can be shown once.
 */
export function resetPasswordWithRecoveryCode(
  recoveryCodeInput: string,
  newPlain: string
): { success: boolean; recoveryCode: string | null } {
  const recoverySalt = getSetting('recovery_salt');
  const storedHash = getSetting('recovery_code_hash');
  if (!recoverySalt || !storedHash) return { success: false, recoveryCode: null };

  const normalized = recoveryCodeInput.trim().toUpperCase();
  const computed = hashWithSalt(normalized, recoverySalt);
  let matches = false;
  try {
    matches = crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    matches = false;
  }
  if (!matches) {
    writeLog('warn', 'auth', 'Failed recovery-code attempt');
    return { success: false, recoveryCode: null };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashWithSalt(newPlain, salt);
  setSetting('password_salt', salt);
  setSetting('password_hash', hash);
  setSetting('password_enabled', 'true');

  const newRecoveryCode = generateRecoveryCode();
  const newRecoverySalt = crypto.randomBytes(16).toString('hex');
  const newRecoveryHash = hashWithSalt(newRecoveryCode, newRecoverySalt);
  setSetting('recovery_salt', newRecoverySalt);
  setSetting('recovery_code_hash', newRecoveryHash);

  writeLog('info', 'auth', 'Password reset via recovery code');
  return { success: true, recoveryCode: newRecoveryCode };
}

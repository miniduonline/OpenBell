// ============================================================
// Update Checker
// ------------------------------------------------------------
// A small, dependency-free helper that asks GitHub's public Releases
// API "what's the latest version?" and compares it to the version
// currently running. No accounts, no telemetry sent about this PC -
// it's a single anonymous GET request to a public endpoint, and it's
// only ever triggered by this PC (nothing runs in the background on
// a server). If there's no internet, every function here just resolves
// to "couldn't check" rather than throwing somewhere unexpected.
// ============================================================

const REPO = 'miniduonline/OpenBell';
const FETCH_TIMEOUT_MS = 6000;

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export type UpdateCheckOutcome =
  | { status: 'update-available'; data: UpdateCheckResult }
  | { status: 'up-to-date'; data: UpdateCheckResult }
  | { status: 'error'; message: string };

function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

/** Trims a GitHub release body down to a short, banner-friendly excerpt. */
function summarizeReleaseNotes(body: string): string {
  if (!body) return '';
  const firstMeaningfulLines = body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);
  return firstMeaningfulLines.join(' · ');
}

/**
 * Performs the actual GitHub API call and comparison. Used by both the
 * silent once-a-day auto-check and the manual "Check for Updates" button
 * in Support settings - same logic, two different triggers.
 */
export async function checkForUpdates(): Promise<UpdateCheckOutcome> {
  let currentVersion = '0.0.0';
  try {
    currentVersion = await window.openbell.getVersion();
  } catch {
    // If we can't even read our own version, there's nothing useful to compare.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      return { status: 'error', message: 'No releases found for this app yet.' };
    }
    if (!res.ok) {
      return { status: 'error', message: `GitHub responded with status ${res.status}.` };
    }

    const json = await res.json();
    const latestVersion = String(json.tag_name ?? '').replace(/^v/, '');
    if (!latestVersion) {
      return { status: 'error', message: 'Could not read the latest version number.' };
    }

    const data: UpdateCheckResult = {
      hasUpdate: isNewerVersion(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      releaseUrl: json.html_url ?? `https://github.com/${REPO}/releases`,
      releaseNotes: summarizeReleaseNotes(json.body ?? ''),
      publishedAt: json.published_at ?? '',
    };

    localStorage.setItem('openbell-update-lastcheck', String(Date.now()));

    return { status: data.hasUpdate ? 'update-available' : 'up-to-date', data };
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      status: 'error',
      message: isAbort ? 'Request timed out - check your internet connection.' : 'No internet connection or GitHub is unreachable.',
    };
  }
}

/** Whether it's been at least `intervalHours` since the last automatic check. */
export function shouldAutoCheck(intervalHours = 24): boolean {
  const lastCheck = Number(localStorage.getItem('openbell-update-lastcheck') ?? '0');
  return Date.now() - lastCheck >= intervalHours * 60 * 60 * 1000;
}

export function getLastCheckedAt(): Date | null {
  const raw = localStorage.getItem('openbell-update-lastcheck');
  return raw ? new Date(Number(raw)) : null;
}

export function isVersionSkipped(version: string): boolean {
  return localStorage.getItem('openbell-update-skip') === version;
}

export function skipVersion(version: string): void {
  localStorage.setItem('openbell-update-skip', version);
}

/** "Remind me later" - don't skip the version, just don't nag again for a few hours. */
export function snoozeUpdateCheck(hours = 12): void {
  localStorage.setItem('openbell-update-lastcheck', String(Date.now() - (24 - hours) * 60 * 60 * 1000));
}

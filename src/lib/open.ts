/**
 * Open a URL in the user's default browser. Best-effort and non-fatal: if it
 * can't launch (headless, no DE), the caller has already printed the link.
 */

import { spawn } from 'node:child_process';

export function openUrl(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [url], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    }).unref();
  } catch {
    /* the link was printed; the user can open it manually */
  }
}

/**
 * Cross-platform "is this binary on PATH?" check.
 */

import { execSync } from 'node:child_process';

export function isInstalled(bin: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

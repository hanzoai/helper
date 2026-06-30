/**
 * Persistent credential + preference store for @hanzo/helper.
 *
 * Lives at ~/.hanzo/config.json with 0600 permissions (it holds a token).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.hanzo');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface HanzoConfig {
  /** OAuth access token from device login (used to mint API keys). */
  accessToken?: string;
  /** Long-lived Hanzo API key (hk-...) used for inference. */
  apiKey?: string;
  /** Signed-in user identity, cached for display. */
  user?: UserInfo;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  org?: string;
}

let cached: HanzoConfig | null = null;

export async function getConfig(): Promise<HanzoConfig> {
  if (cached) return cached;
  let file: HanzoConfig = {};
  try {
    file = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8')) as HanzoConfig;
  } catch {
    /* no config file yet */
  }
  // HANZO_API_KEY (the same var Codex reads) overrides the stored key, so the
  // helper works headless — in CI or a fresh shell — with no written config.
  const envKey = process.env.HANZO_API_KEY?.trim();
  cached = envKey ? { ...file, apiKey: envKey } : file;
  return cached;
}

export async function setConfig(
  updater: (config: HanzoConfig) => HanzoConfig
): Promise<HanzoConfig> {
  const updated = updater(await getConfig());
  cached = updated;
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}

export async function clearConfig(): Promise<void> {
  cached = {};
  await fs.rm(CONFIG_FILE, { force: true });
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

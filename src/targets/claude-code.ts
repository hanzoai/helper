/**
 * Claude Code target.
 *
 * Uses the `providers.hanzo` block in ~/.claude/settings.json — an additive,
 * non-destructive entry that lets users switch to Hanzo models per-session
 * without replacing the default connection. The top-level `model` field is
 * updated to the selected Hanzo default, while the rest of the settings stay
 * intact.
 *
 * Config paths are identical on all platforms (home-relative). Claude Code
 * also looks at CLAUDE_SETTINGS_PATH env override.
 */

import path from 'node:path';
import os from 'node:os';
import { readJson, writeJson } from '../lib/json-config';
import { isInstalled } from '../lib/which';
import { type CodingTarget, type HanzoCredentials, type TargetStatus, maskKey } from './types';

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');

interface ClaudeSettings {
  model?: string;
  providers?: Record<string, {
    apiKey?: string;
    baseURL?: string;
    name?: string;
    models?: string[];
  }>;
  [k: string]: unknown;
}

// Curated flagship coding models surfaced in Claude Code's picker (the live
// catalog carries 60+ ids — too many to list). The selected default is always
// merged in below, so the picker never omits what the user actually chose.
const HANZO_MODELS = ['glm-5.2', 'deepseek-v4-flash', 'deepseek-v4-pro', 'zen5-max'];

export const claudeCode: CodingTarget = {
  id: 'claude-code',
  displayName: 'Claude Code',
  bin: 'claude',
  installCommand: 'npm install -g @anthropic-ai/claude-code',

  configure(creds: HanzoCredentials): void {
    const settings = readJson<ClaudeSettings>(SETTINGS);
    settings.providers = {
      ...settings.providers,
      hanzo: {
        name: 'Hanzo AI',
        apiKey: creds.apiKey,
        baseURL: creds.apiBase + '/v1',
        models: Array.from(new Set([creds.model, ...HANZO_MODELS])),
      },
    };
    settings.model = creds.model;
    writeJson(SETTINGS, settings);

    const claudeJson = readJson<{ hasCompletedOnboarding?: boolean }>(CLAUDE_JSON);
    if (!claudeJson.hasCompletedOnboarding) {
      writeJson(CLAUDE_JSON, { ...claudeJson, hasCompletedOnboarding: true });
    }
  },

  unconfigure(): void {
    const settings = readJson<ClaudeSettings>(SETTINGS);
    if (settings.providers?.hanzo) {
      delete settings.providers.hanzo;
      if (Object.keys(settings.providers).length === 0) delete settings.providers;
    }
    writeJson(SETTINGS, settings);
  },

  status(): TargetStatus {
    const key = readJson<ClaudeSettings>(SETTINGS).providers?.hanzo?.apiKey;
    return {
      installed: isInstalled(this.bin),
      configured: typeof key === 'string' && key.startsWith('hk-'),
      ...(typeof key === 'string' ? { apiKeyMasked: maskKey(key) } : {}),
    };
  },
};

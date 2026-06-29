/**
 * Claude Code target.
 *
 * Uses the `providers.hanzo` block in ~/.claude/settings.json — an additive,
 * non-destructive entry that lets users switch to Hanzo models per-session
 * (`/model hanzo/deepseek-v4-pro`) without replacing the default Anthropic
 * connection. The env block is NOT touched so the current session stays intact.
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
  providers?: Record<string, {
    apiKey?: string;
    baseURL?: string;
    name?: string;
    models?: string[];
  }>;
  [k: string]: unknown;
}

const HANZO_MODELS = [
  'zen5-ultra', 'zen5-max', 'zen5-pro', 'zen5', 'zen5-mini',
  'zen4-ultra', 'zen4-max', 'zen4-pro', 'zen4', 'zen4-coder-pro', 'zen4-coder', 'zen4-thinking',
  'glm-5.2', 'glm-5.1', 'glm-5',
  'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v3.2', 'deepseek-reasoner',
  'qwen3.5-397b', 'qwen3-coder',
  'kimi-k2.6',
  'llama-4-maverick',
  'nemotron-3-ultra-550b',
  'minimax-m2.5',
];

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
        models: HANZO_MODELS,
      },
    };
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

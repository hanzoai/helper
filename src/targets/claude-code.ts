/**
 * Claude Code target.
 *
 * Claude Code speaks the Anthropic protocol and reads its provider from the
 * `env` block of ~/.claude/settings.json:
 *   ANTHROPIC_AUTH_TOKEN  the bearer token sent on every request
 *   ANTHROPIC_BASE_URL    where /v1/messages lives
 * Hanzo serves /v1/messages at the API root, so the base URL is just the API
 * origin. We also set hasCompletedOnboarding in ~/.claude.json so a fresh
 * install doesn't trap the user in the first-run wizard.
 */

import path from 'node:path';
import os from 'node:os';
import { readJson, writeJson } from '../lib/json-config';
import { isInstalled } from '../lib/which';
import { type CodingTarget, type HanzoCredentials, type TargetStatus, maskKey } from './types';

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');

// Keys we own in settings.env — added on configure, removed on unconfigure.
const MANAGED_ENV = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'API_TIMEOUT_MS',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
] as const;

interface ClaudeSettings {
  env?: Record<string, string | number>;
  [k: string]: unknown;
}

export const claudeCode: CodingTarget = {
  id: 'claude-code',
  displayName: 'Claude Code',
  bin: 'claude',
  installCommand: 'npm install -g @anthropic-ai/claude-code',

  configure(creds: HanzoCredentials): void {
    const settings = readJson<ClaudeSettings>(SETTINGS);
    const env = { ...settings.env };
    delete env['ANTHROPIC_API_KEY']; // avoid two competing auth vars

    settings.env = {
      ...env,
      ANTHROPIC_AUTH_TOKEN: creds.apiKey,
      ANTHROPIC_BASE_URL: creds.apiBase,
      ANTHROPIC_MODEL: creds.model,
      API_TIMEOUT_MS: '3000000',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
    };
    writeJson(SETTINGS, settings);

    const claudeJson = readJson<{ hasCompletedOnboarding?: boolean }>(CLAUDE_JSON);
    if (!claudeJson.hasCompletedOnboarding) {
      writeJson(CLAUDE_JSON, { ...claudeJson, hasCompletedOnboarding: true });
    }
  },

  unconfigure(): void {
    const settings = readJson<ClaudeSettings>(SETTINGS);
    if (!settings.env) return;
    for (const key of MANAGED_ENV) delete settings.env[key];
    if (Object.keys(settings.env).length === 0) delete settings.env;
    writeJson(SETTINGS, settings);
  },

  status(): TargetStatus {
    const token = readJson<ClaudeSettings>(SETTINGS).env?.['ANTHROPIC_AUTH_TOKEN'];
    return {
      installed: isInstalled(this.bin),
      configured: typeof token === 'string' && token.length > 0,
      ...(typeof token === 'string' ? { apiKeyMasked: maskKey(token) } : {}),
    };
  },
};

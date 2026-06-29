/**
 * Codex target.
 *
 * Codex (the OpenAI CLI) reads ~/.codex/config.toml. A custom provider is an
 * OpenAI-compatible endpoint declared under [model_providers.<id>], selected by
 * top-level `model` + `model_provider`. The provider's key is taken from an
 * environment variable named by `env_key`; we write that var into ~/.hanzo/env
 * and configure Codex to read HANZO_API_KEY. Hanzo serves /v1/chat/completions
 * at the API root, so wire_api = "chat" with base_url = <api>/v1.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { parse, stringify } from 'smol-toml';
import { isInstalled } from '../lib/which';
import { type CodingTarget, type HanzoCredentials, type TargetStatus, maskKey } from './types';

const CONFIG = path.join(os.homedir(), '.codex', 'config.toml');
const ENV_FILE = path.join(os.homedir(), '.hanzo', 'env');
const ENV_KEY = 'HANZO_API_KEY';
const PROVIDER_ID = 'hanzo';

interface CodexConfig {
  model?: string;
  model_provider?: string;
  model_providers?: Record<string, CodexProvider>;
  [k: string]: unknown;
}

interface CodexProvider {
  name: string;
  base_url: string;
  env_key: string;
  wire_api?: string;
}

export const codex: CodingTarget = {
  id: 'codex',
  displayName: 'Codex',
  bin: 'codex',
  installCommand: 'npm install -g @openai/codex',

  configure(creds: HanzoCredentials): void {
    const config = readToml();

    config.model = creds.model;
    config.model_provider = PROVIDER_ID;
    config.model_providers = {
      ...config.model_providers,
      [PROVIDER_ID]: {
        name: 'Hanzo',
        base_url: `${creds.apiBase}/v1`,
        env_key: ENV_KEY,
        wire_api: 'chat',
      },
    };
    writeToml(config);
    writeEnvFile(creds.apiKey);
  },

  unconfigure(): void {
    const config = readToml();
    if (config.model_providers) {
      delete config.model_providers[PROVIDER_ID];
      if (Object.keys(config.model_providers).length === 0) delete config.model_providers;
    }
    if (config.model_provider === PROVIDER_ID) {
      delete config.model_provider;
      delete config.model;
    }
    writeToml(config);
    fs.rmSync(ENV_FILE, { force: true });
  },

  status(): TargetStatus {
    const config = readToml();
    const configured = config.model_provider === PROVIDER_ID;
    const key = readEnvFile();
    return {
      installed: isInstalled(this.bin),
      configured,
      ...(key ? { apiKeyMasked: maskKey(key) } : {}),
    };
  },
};

/**
 * The env line that makes the key available to Codex. `hanzo login` prints this
 * so users can add it to their shell rc; sourcing ~/.hanzo/env also works.
 */
export function codexEnvHint(): string {
  return `export ${ENV_KEY}="$(cat ${ENV_FILE} 2>/dev/null)"`;
}

function readToml(): CodexConfig {
  try {
    return parse(fs.readFileSync(CONFIG, 'utf-8')) as CodexConfig;
  } catch {
    return {};
  }
}

function writeToml(config: CodexConfig): void {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, stringify(config), 'utf-8');
}

function writeEnvFile(apiKey: string): void {
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, apiKey, { mode: 0o600 });
}

function readEnvFile(): string | undefined {
  try {
    return fs.readFileSync(ENV_FILE, 'utf-8').trim() || undefined;
  } catch {
    return undefined;
  }
}

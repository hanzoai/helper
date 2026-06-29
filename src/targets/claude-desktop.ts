/**
 * Claude Desktop target.
 *
 * Claude Desktop is configured via claude_desktop_config.json. Location varies
 * by platform:
 *   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   Windows: %APPDATA%\Claude\claude_desktop_config.json
 *   Linux:   ~/.config/Claude/claude_desktop_config.json
 *
 * Hanzo MCP server is wired as a named server entry so users get Hanzo tools
 * directly in Claude Desktop conversations. The API key is passed as an env var
 * to the server process — it never appears in the UI.
 */

import path from 'node:path';
import os from 'node:os';
import { readJson, writeJson } from '../lib/json-config';
import { isInstalled } from '../lib/which';
import { type CodingTarget, type HanzoCredentials, type TargetStatus, maskKey } from './types';

function configPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

interface DesktopConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  [k: string]: unknown;
}

export const claudeDesktop: CodingTarget = {
  id: 'claude-desktop',
  displayName: 'Claude Desktop',
  bin: process.platform === 'win32' ? 'claude' : 'Claude',
  installCommand: 'Download from https://claude.ai/download',

  configure(creds: HanzoCredentials): void {
    const config = readJson<DesktopConfig>(configPath());
    config.mcpServers = {
      ...config.mcpServers,
      hanzo: {
        command: 'npx',
        args: ['-y', '@hanzo/mcp'],
        env: {
          HANZO_API_KEY: creds.apiKey,
          HANZO_API_BASE: creds.apiBase,
        },
      },
    };
    writeJson(configPath(), config);
  },

  unconfigure(): void {
    const config = readJson<DesktopConfig>(configPath());
    if (config.mcpServers?.hanzo) {
      delete config.mcpServers.hanzo;
      if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
    }
    writeJson(configPath(), config);
  },

  status(): TargetStatus {
    const key = readJson<DesktopConfig>(configPath()).mcpServers?.hanzo?.env?.['HANZO_API_KEY'];
    // Claude Desktop is a GUI app — check the config file exists instead of PATH.
    const configured = typeof key === 'string' && key.startsWith('hk-');
    return {
      installed: isInstalled('claude') || isInstalled('Claude'),
      configured,
      ...(typeof key === 'string' ? { apiKeyMasked: maskKey(key) } : {}),
    };
  },
};

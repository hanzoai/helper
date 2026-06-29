/**
 * Shell-environment install mode.
 *
 * Writes a managed block to the user's shell rc that exports the Anthropic-
 * protocol env vars Claude Code (and any Anthropic-SDK client) reads:
 *   ANTHROPIC_BASE_URL   where /v1/messages lives  (Hanzo: the API origin)
 *   ANTHROPIC_AUTH_TOKEN the hk- key sent as the bearer
 *   ANTHROPIC_MODEL      default model id
 *
 * This is the "make Hanzo my Claude backend everywhere" mode — it affects every
 * tool that honors those vars, not just one config file. Contrast with the
 * per-tool settings mode (targets/*), which is additive and scoped to one tool.
 *
 * The block is delimited by sentinel comments so we own exactly those lines and
 * can rewrite or remove them without touching the user's other rc content.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { HanzoCredentials } from '../targets/types';

const BEGIN = '# >>> hanzo helper >>>';
const END = '# <<< hanzo helper <<<';

export interface ShellTarget {
  /** Shell name, e.g. "zsh". */
  shell: string;
  /** Absolute path to the rc file we'd edit. */
  rcFile: string;
}

/** Detect the user's login shell and the rc file to edit. */
export function detectShell(): ShellTarget {
  const shell = (process.env['SHELL'] ?? '').split('/').pop() || 'sh';
  const home = os.homedir();
  switch (shell) {
    case 'zsh':
      return { shell, rcFile: path.join(home, '.zshrc') };
    case 'bash':
      return { shell, rcFile: path.join(home, '.bashrc') };
    case 'fish':
      return { shell, rcFile: path.join(home, '.config', 'fish', 'config.fish') };
    default:
      return { shell, rcFile: path.join(home, '.profile') };
  }
}

/** Render the managed export block for the detected shell. */
function renderBlock(target: ShellTarget, creds: HanzoCredentials): string {
  const lines =
    target.shell === 'fish'
      ? [
          `set -gx ANTHROPIC_BASE_URL "${creds.apiBase}"`,
          `set -gx ANTHROPIC_AUTH_TOKEN "${creds.apiKey}"`,
          `set -gx ANTHROPIC_MODEL "${creds.model}"`,
        ]
      : [
          `export ANTHROPIC_BASE_URL="${creds.apiBase}"`,
          `export ANTHROPIC_AUTH_TOKEN="${creds.apiKey}"`,
          `export ANTHROPIC_MODEL="${creds.model}"`,
        ];
  return [BEGIN, ...lines, END].join('\n');
}

/** Strip any existing managed block from rc content. */
function stripBlock(content: string): string {
  const pattern = new RegExp(`\\n?${escape(BEGIN)}[\\s\\S]*?${escape(END)}\\n?`, 'g');
  return content.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n');
}

/** Install (or refresh) the managed export block. Returns the rc file written. */
export function installShellEnv(creds: HanzoCredentials, target = detectShell()): ShellTarget {
  fs.mkdirSync(path.dirname(target.rcFile), { recursive: true });
  const existing = readFileSafe(target.rcFile);
  const body = stripBlock(existing).replace(/\s*$/, '');
  const next = `${body}\n\n${renderBlock(target, creds)}\n`;
  fs.writeFileSync(target.rcFile, next.replace(/^\n+/, ''), 'utf-8');
  return target;
}

/** Remove the managed export block. No-op if absent. */
export function uninstallShellEnv(target = detectShell()): void {
  const existing = readFileSafe(target.rcFile);
  if (!existing.includes(BEGIN)) return;
  fs.writeFileSync(target.rcFile, stripBlock(existing).replace(/^\n+/, ''), 'utf-8');
}

/** True if our managed block is present in the rc file. */
export function shellEnvInstalled(target = detectShell()): boolean {
  return readFileSafe(target.rcFile).includes(BEGIN);
}

function readFileSafe(file: string): string {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

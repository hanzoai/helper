/**
 * A CodingTarget is any coding tool the helper can point at Hanzo: it knows how
 * to detect itself, write the Hanzo provider into its own config format, and
 * remove it again. One interface, one implementation per tool — orthogonal.
 */

export interface HanzoCredentials {
  apiKey: string;
  /** Cloud API base, e.g. https://api.hanzo.ai (no trailing slash). */
  apiBase: string;
  /** Default model id to select, e.g. claude-opus-4-8 or glm-5.2. */
  model: string;
}

export interface TargetStatus {
  /** True if the tool's CLI binary is on PATH. */
  installed: boolean;
  /** True if this tool is currently pointed at Hanzo. */
  configured: boolean;
  /** Masked API key currently in the tool's config, if any. */
  apiKeyMasked?: string;
}

export interface CodingTarget {
  /** Stable id used on the command line, e.g. "claude-code". */
  readonly id: string;
  /** Human label, e.g. "Claude Code". */
  readonly displayName: string;
  /** PATH binary that proves the tool is installed, e.g. "claude". */
  readonly bin: string;
  /** npm/script command to install the tool, if installable that way. */
  readonly installCommand?: string;

  /** Point this tool at Hanzo using the given credentials. */
  configure(creds: HanzoCredentials): void;
  /** Remove Hanzo configuration, leaving the tool's other settings intact. */
  unconfigure(): void;
  /** Inspect install + configuration state. */
  status(): TargetStatus;
}

export function maskKey(key: string): string {
  if (key.length <= 10) return '****';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

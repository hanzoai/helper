/**
 * Registry of all coding tools the helper can point at Hanzo.
 * Add a new tool by implementing CodingTarget and listing it here — nothing
 * else in the CLI needs to change.
 */

import type { CodingTarget } from './types';
import { claudeCode } from './claude-code';
import { codex } from './codex';

export const TARGETS: readonly CodingTarget[] = [claudeCode, codex];

export function getTarget(id: string): CodingTarget | undefined {
  return TARGETS.find((t) => t.id === id);
}

export { codexEnvHint } from './codex';
export * from './types';

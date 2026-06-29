/**
 * Curated default models offered during setup. The live list is whatever
 * api.hanzo.ai/v1/models returns; this is just the short pick-list shown when
 * choosing a default for a coding tool. `fetchModels` queries the real catalog.
 */

import { endpoints } from './endpoints';

export interface ModelChoice {
  id: string;
  label: string;
}

/**
 * Friendly capability tiers → concrete live model ids (all verified against
 * api.hanzo.ai/v1/models). Pick a tier by the job, not the vendor; `hanzo use
 * --model pro` resolves through `resolveModel`. The underlying id can change as
 * the catalog evolves without users relearning names.
 */
export const TIERS = {
  default: 'glm-5.2', // fast, strong all-rounder — the everyday default
  flash: 'deepseek-v4-flash', // cheapest/fastest for high-volume, simple work
  pro: 'deepseek-v4-pro', // stronger reasoning and coding
  ultra: 'qwen3.5-397b', // frontier-scale dense model for the hardest tasks
  max: 'zen5-max', // Hanzo's top Zen tier (premium)
} as const;

export type Tier = keyof typeof TIERS;

/**
 * Resolve a user-supplied model: a tier alias (`pro`) maps to its live id, and
 * any other value is treated as an explicit model id and passed through.
 */
export function resolveModel(input: string): string {
  return (TIERS as Record<string, string>)[input] ?? input;
}

/**
 * Curated pick-list shown during setup — tiers first (the recommended way to
 * choose), then a few notable named models. GLM 5.2 (`default`) leads: fast,
 * strong at coding, works through both the OpenAI and Anthropic surfaces. The
 * full catalog is always available via `hanzo models`.
 */
export const FEATURED_MODELS: readonly ModelChoice[] = [
  { id: TIERS.default, label: 'default — GLM 5.2, fast all-rounder' },
  { id: TIERS.flash, label: 'flash — DeepSeek V4 Flash, cheapest & fastest' },
  { id: TIERS.pro, label: 'pro — DeepSeek V4 Pro, stronger reasoning' },
  { id: TIERS.ultra, label: 'ultra — Qwen 3.5 397B, frontier scale' },
  { id: TIERS.max, label: 'max — Zen 5 Max (Hanzo, premium)' },
  { id: 'zen4-coder-pro', label: 'Zen 4 Coder Pro (Hanzo, coding)' },
];

export const DEFAULT_MODEL = TIERS.default;

/** Fetch the live model catalog from Hanzo Cloud (OpenAI-compatible shape). */
export async function fetchModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${endpoints.api}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Could not list models (${res.status} ${res.statusText})`);
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  return (body.data ?? []).map((m) => m.id).sort();
}

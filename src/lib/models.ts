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

/** Sensible defaults across the providers Hanzo Cloud fronts. */
export const FEATURED_MODELS: readonly ModelChoice[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (Anthropic)' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4 (Anthropic)' },
  { id: 'glm-5.2', label: 'GLM 5.2 (Zhipu)' },
  { id: 'gpt-5.4', label: 'GPT-5.4 (OpenAI)' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6 (Moonshot)' },
];

export const DEFAULT_MODEL = 'claude-opus-4-8';

/** Fetch the live model catalog from Hanzo Cloud (OpenAI-compatible shape). */
export async function fetchModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${endpoints.api}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Could not list models (${res.status} ${res.statusText})`);
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  return (body.data ?? []).map((m) => m.id).sort();
}

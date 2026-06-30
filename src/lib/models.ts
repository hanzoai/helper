/**
 * Model catalog — everything here is read live from api.hanzo.ai/v1/models.
 * Nothing about which models exist, what they cost, or which the cloud routes
 * to is baked into this CLI: the cloud is the single source of truth, so the
 * helper keeps working unchanged as the catalog evolves.
 *
 * The only stable thing the helper owns is a handful of friendly *effort words*
 * (`fast`, `high`, `max`, …). These are pure input sugar over the cloud's own
 * semantic routing aliases (`zen-auto`, `zen-pro`, …): the alias is a real model
 * id, and the cloud decides server-side which concrete model it runs. So even
 * the tier mapping is dynamic — we never name a concrete model here.
 */

import { endpoints } from './endpoints';

export interface CloudModel {
  id: string;
  /** Balance-gated: callable only with positive credits (402 otherwise). */
  premium: boolean;
  /** Provider/owner reported by the cloud, e.g. "hanzo", "deepseek". */
  ownedBy: string;
}

/** Live catalog from Hanzo Cloud (OpenAI-compatible shape), sorted by id. */
export async function fetchCatalog(apiKey: string): Promise<CloudModel[]> {
  const res = await fetch(`${endpoints.api}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Could not list models (${res.status} ${res.statusText})`);
  const body = (await res.json()) as {
    data?: Array<{ id: string; premium?: boolean; owned_by?: string }>;
  };
  return (body.data ?? [])
    .map((m) => ({ id: m.id, premium: m.premium ?? false, ownedBy: m.owned_by ?? '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Convenience: just the ids from the live catalog. */
export async function fetchModels(apiKey: string): Promise<string[]> {
  return (await fetchCatalog(apiKey)).map((m) => m.id);
}

/**
 * The cloud's semantic routing aliases — `zen-<word>` with no version digit
 * (`zen-auto`, `zen-pro`, `zen-max`, `zen-code`, …). Each is a real, callable
 * model id; the cloud resolves it to the best concrete model at that effort
 * level. Discovered from the live catalog, never hardcoded.
 */
const ALIAS_RE = /^zen-[a-z]+$/;

export function aliasesFrom(catalog: CloudModel[]): CloudModel[] {
  return catalog.filter((m) => ALIAS_RE.test(m.id));
}

/**
 * Friendly effort words accepted anywhere a model is asked for. They are sugar
 * over the cloud's routing aliases — the cloud still chooses the model. Listed
 * cheapest→strongest; `auto` lets the cloud pick. Anything not a known word
 * (e.g. a concrete id like `glm-5.2`) passes straight through.
 */
export const EFFORT_ALIASES: Record<string, string> = {
  auto: 'zen-auto',
  fast: 'zen-normal',
  low: 'zen-normal',
  normal: 'zen-normal',
  high: 'zen-pro',
  pro: 'zen-pro',
  xhigh: 'zen-max',
  max: 'zen-max',
  ultra: 'zen-max',
  code: 'zen-code',
  coding: 'zen-code',
  agent: 'zen-agent',
};

/** Effort words in display order (cheapest→strongest), for help text and prompts. */
export const EFFORT_ORDER = ['auto', 'fast', 'high', 'max', 'code', 'agent'] as const;

/** Resolve a user-supplied model: an effort word maps to its cloud alias; any
 *  other value is treated as an explicit model id and passed through. */
export function resolveModel(input: string): string {
  return EFFORT_ALIASES[input.trim().toLowerCase()] ?? input.trim();
}

/**
 * Recommended default: `zen-auto`. The cloud routes it to the best available
 * model, so it keeps working no matter how the catalog changes — the most
 * "dynamic, works no matter what" choice for a fresh setup. Users can pick any
 * concrete id in the wizard instead.
 */
export const DEFAULT_MODEL = 'zen-auto';

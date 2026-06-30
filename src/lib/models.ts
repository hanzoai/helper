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
 * A model as the public pricing catalog publishes it
 * (`pricing.<brand>/v1/pricing/models`) — the same source the console renders:
 * normalized provider, plan tier, context window, arch/params, and $/Mtok.
 */
export interface RichModel {
  name: string;
  /** Catalog id — bare for first-party (`zen3-omni`), OpenRouter-style for
   *  third-party (`z-ai/glm-5.2`). The routing id is its last path segment. */
  id?: string;
  fullName?: string;
  description?: string;
  category?: string;
  provider?: string;
  tier?: string;
  context?: number | null;
  specs?: { arch?: string; params?: string };
  features?: string[];
  pricing?: {
    input?: number | null;
    output?: number | null;
    cacheRead?: number | null;
    cacheWrite?: number | null;
  };
}

/**
 * A rich model resolved against your live routing set: `routeId` is the id you
 * actually pass to `--model`, `available` says whether your key can call it now.
 */
export type RichEntry = RichModel & { available: boolean; routeId: string };

/** Public rich catalog — no key needed; it's the same data the console shows. */
export async function fetchRichCatalog(): Promise<RichModel[]> {
  const res = await fetch(`${endpoints.pricing}/v1/pricing/models`);
  if (!res.ok) throw new Error(`Could not load catalog (${res.status} ${res.statusText})`);
  const body = (await res.json()) as { models?: RichModel[] };
  return body.models ?? [];
}

const lower = (s: string) => s.toLowerCase();
/** The routing id is the last path segment of a catalog id/name (`a/b` → `b`). */
const lastSeg = (s?: string) => (s ? s.split('/').pop()! : '');

/** Every lowercased key a catalog entry can be matched on. */
function matchKeys(m: RichModel): string[] {
  return [m.id, m.name, lastSeg(m.id), lastSeg(m.name)].filter((k): k is string => !!k).map(lower);
}

/** Find a catalog model by any of its ids/names (case-insensitive). */
export function findModel(catalog: RichModel[], query: string): RichModel | undefined {
  const q = lower(query);
  return catalog.find((m) => matchKeys(m).includes(q));
}

/**
 * Join the rich catalog with your live routing set. One row per model you can
 * actually call (keyed by the bare routing id, with its rich metadata), then —
 * for `--all` — every other catalog model, marked unavailable. Mirrors the
 * console's Models page: rich fields + honest availability, nothing invented.
 */
export async function fetchJoinedCatalog(apiKey: string): Promise<RichEntry[]> {
  const [rich, ids] = await Promise.all([
    fetchRichCatalog(),
    fetchModels(apiKey).catch(() => [] as string[]),
  ]);

  // Index the catalog by every matchable key; first entry wins on collision.
  const index = new Map<string, RichModel>();
  for (const m of rich) for (const k of matchKeys(m)) if (!index.has(k)) index.set(k, m);

  const live: RichEntry[] = ids.map((id) => {
    const m = index.get(lower(id));
    return { ...(m ?? { name: id }), name: m?.name ?? id, routeId: id, available: true };
  });

  const liveKeys = new Set(ids.map(lower));
  const rest: RichEntry[] = rich
    .filter((m) => !matchKeys(m).some((k) => liveKeys.has(k)))
    .map((m) => ({ ...m, routeId: lastSeg(m.id) || m.name, available: false }));

  live.sort((a, b) => a.routeId.localeCompare(b.routeId));
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [...live, ...rest];
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
 * Recommended default: `glm-5.2`. It is the stable concrete default the helper
 * writes for fresh setups; users can still override it with any effort word or
 * explicit model id in the wizard.
 */
export const DEFAULT_MODEL = 'glm-5.2';

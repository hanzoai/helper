/**
 * KMS client — pull environment secrets for local dev.
 *
 * Uses the canonical, already-live KMS API (KMS owns /v1/kms/*): the dev's IAM
 * login token is presented directly — KMS verifies it against hanzo.id's JWKS
 * (authorize + canActOnOrg), no separate exchange. One token, one way.
 *
 *   list   GET /v1/kms/orgs/{org}/secrets?env=X            → key metadata (no values)
 *   get    GET /v1/kms/orgs/{org}/secrets/{path}/{name}?env=X → one value
 *
 * By KMS's design the bulk list returns KEYS ONLY; values are read one at a
 * time. `pullSecrets` composes the two: list the env, then read each value.
 * IAM lives under /v1/iam/*, KMS under /v1/kms/* — the helper never crosses them.
 */

import { endpoints } from './endpoints';

/** Environments secrets are scoped by — the network/deploy axis. */
export const KMS_ENVS = ['devnet', 'testnet', 'mainnet', 'production'] as const;
export type KmsEnv = (typeof KMS_ENVS)[number];

/** Environments that may hold production material — named so the CLI can warn
 *  before writing them to a local file (KMS still gates access server-side). */
export const KMS_PROD_ENVS: ReadonlySet<string> = new Set(['mainnet', 'production']);

export class KmsError extends Error {}

/** One metadata row from the list endpoint — keys only, never a value. */
interface SecretMeta {
  path: string;
  name: string;
  env: string;
}

const base = (org: string) => `${endpoints.api}/v1/kms/orgs/${encodeURIComponent(org)}/secrets`;

const authFail = (res: Response, what: string): KmsError =>
  res.status === 401 || res.status === 403
    ? new KmsError(`KMS denied ${what} (${res.status}). Run \`hanzo login\` to refresh, or check your org access.`)
    : new KmsError(`KMS ${what} failed (${res.status} ${res.statusText})`);

/** List an env's secret keys (no values) for the org. */
export async function listSecrets(iamToken: string, org: string, env: string): Promise<SecretMeta[]> {
  const url = new URL(base(org));
  url.searchParams.set('env', env);
  const res = await fetch(url, { headers: auth(iamToken) });
  if (!res.ok) throw authFail(res, 'secret listing');
  const body = (await res.json().catch(() => null)) as { secrets?: SecretMeta[] } | null;
  return body?.secrets ?? [];
}

/** Read one secret's value. `path` may be empty; `name` is required. */
export async function getSecret(
  iamToken: string,
  org: string,
  meta: SecretMeta,
  env: string
): Promise<string> {
  const rest = meta.path ? `${meta.path}/${meta.name}` : meta.name;
  const url = new URL(`${base(org)}/${rest}`);
  url.searchParams.set('env', env);
  const res = await fetch(url, { headers: auth(iamToken) });
  if (!res.ok) throw authFail(res, `read ${meta.name}`);
  const body = (await res.json().catch(() => null)) as { secret?: { value?: string } } | null;
  return body?.secret?.value ?? '';
}

/**
 * Pull every secret for one environment as a flat name→value map. Lists the
 * env's keys, then reads each value (KMS has no bulk-value endpoint by design).
 * Reads run with bounded concurrency so a large env stays quick without
 * hammering the service.
 */
export async function pullSecrets(iamToken: string, org: string, env: string): Promise<Record<string, string>> {
  const metas = await listSecrets(iamToken, org, env);
  const out: Record<string, string> = {};
  const CONCURRENCY = 8;
  for (let i = 0; i < metas.length; i += CONCURRENCY) {
    const batch = metas.slice(i, i + CONCURRENCY);
    const values = await Promise.all(batch.map((m) => getSecret(iamToken, org, m, env)));
    batch.forEach((m, j) => (out[m.name] = values[j]!));
  }
  return out;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

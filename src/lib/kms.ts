/**
 * KMS client — pull environment secrets for local dev.
 *
 * One mechanism, shared with CI: an OIDC token (the dev's IAM login here; a
 * GitHub OIDC token in Actions) is exchanged at /v1/kms/oidc/login for a
 * short-lived KMS token, which reads an environment's secrets from
 * /v1/kms/get-secrets. KMS owns secrets, envs, and authz; IAM only issues the
 * token. They compose through the token — neither imports the other.
 *
 * Concerns stay in their own path namespace: KMS lives under `/v1/kms/*`, IAM
 * under `/v1/iam/*`. The helper never crosses them.
 */

import { endpoints } from './endpoints';

/** KMS surface — KMS only, under its own `/v1/kms` namespace. Verb-noun names
 *  match the IAM house style (`/v1/iam/get-account`, `/v1/iam/get-users`). */
const KMS_PATHS = {
  oidcLogin: '/v1/kms/oidc/login',
  getSecrets: '/v1/kms/get-secrets',
} as const;

/** Environments secrets are scoped by — the network/deploy axis. */
export const KMS_ENVS = ['devnet', 'testnet', 'mainnet', 'production'] as const;
export type KmsEnv = (typeof KMS_ENVS)[number];

/** Environments that may hold production material — gated server-side; named so
 *  the CLI can warn before writing them to a local file. */
export const KMS_PROD_ENVS: ReadonlySet<string> = new Set(['mainnet', 'production']);

/**
 * Exchange a trusted OIDC token (the dev's IAM access token) for a short-lived
 * KMS token. KMS validates it against the issuer's JWKS and applies its own
 * env/path authorization.
 */
export async function kmsLogin(oidcToken: string): Promise<string> {
  const res = await fetch(`${endpoints.api}${KMS_PATHS.oidcLogin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${oidcToken}`, Accept: 'application/json' },
  });
  if (res.status === 401) {
    throw new KmsError('KMS rejected your login. Run `hanzo login` to refresh, then retry.');
  }
  if (!res.ok) throw new KmsError(`KMS login failed (${res.status} ${res.statusText})`);
  const body = (await res.json().catch(() => null)) as { token?: string; accessToken?: string } | null;
  const token = body?.token ?? body?.accessToken;
  if (!token) throw new KmsError('KMS did not return a token');
  return token;
}

/** Fetch every secret for one environment as a flat key→value map. */
export async function kmsSecrets(kmsToken: string, env: string, path = '/'): Promise<Record<string, string>> {
  const url = new URL(`${endpoints.api}${KMS_PATHS.getSecrets}`);
  url.searchParams.set('env', env);
  if (path && path !== '/') url.searchParams.set('path', path);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${kmsToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new KmsError(`KMS secrets fetch failed (${res.status} ${res.statusText})`);
  const body = (await res.json().catch(() => null)) as { secrets?: unknown } | null;
  return normalizeSecrets(body?.secrets);
}

/** Login + fetch in one step — the common path. */
export async function pullSecrets(
  oidcToken: string,
  env: string,
  path = '/'
): Promise<Record<string, string>> {
  return kmsSecrets(await kmsLogin(oidcToken), env, path);
}

export class KmsError extends Error {}

/**
 * Accept either shape KMS may return — a flat `{KEY: value}` map or an array of
 * `{secretKey, secretValue}` (Infisical-style) — and flatten to `{KEY: value}`.
 */
function normalizeSecrets(secrets: unknown): Record<string, string> {
  if (!secrets) return {};
  if (Array.isArray(secrets)) {
    const out: Record<string, string> = {};
    for (const s of secrets as Array<Record<string, unknown>>) {
      const k = (s.secretKey ?? s.key ?? s.name) as string | undefined;
      const v = (s.secretValue ?? s.value) as string | undefined;
      if (k != null && v != null) out[k] = String(v);
    }
    return out;
  }
  if (typeof secrets === 'object') {
    return Object.fromEntries(
      Object.entries(secrets as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  }
  return {};
}

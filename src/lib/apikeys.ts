/**
 * Hanzo Cloud API key — the per-user `hk-` credential presented as
 * `Authorization: Bearer hk-…` to every OpenAI/Anthropic-compatible endpoint.
 *
 * The key is the IAM user's `accessKey` (object/user.go). Two authoritative ops,
 * both authorized by the device-login JWT as the *self* caller
 * (iam resolveTargetUserForKeys: admin OR self OR allowlisted app):
 *
 *   read   GET  {api}/v1/get-account        → claims.accessKey
 *   mint   POST {iam}/mint-user-keys        → { accessKey }   (self)
 *
 * `ensureApiKey` reads the existing key and only mints when the account has none
 * — minting *rotates*, so we never clobber a key the user is already using.
 */

import { endpoints, IAM_PATHS } from './endpoints';

export class ApiKeyError extends Error {}

/** Read the signed-in user's current `hk-` key, or undefined if none exists. */
export async function readApiKey(accessToken: string): Promise<string | undefined> {
  const res = await fetch(`${endpoints.api}/v1/get-account`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new ApiKeyError(`Could not read account (${res.status} ${res.statusText})`);
  }
  // get-account returns IAM Claims; the user fields are inlined on the claims.
  const claims = (await res.json()) as { accessKey?: string; data?: { accessKey?: string } };
  const key = claims.accessKey ?? claims.data?.accessKey;
  return key && key.startsWith('hk-') ? key : undefined;
}

/**
 * Mint (rotate) the signed-in user's `hk-` key. IAM authorizes the caller as
 * *self* from the bearer JWT — no `id` param means "operate on me". Returns the
 * full key, shown once.
 */
export async function mintApiKey(accessToken: string): Promise<string> {
  const res = await fetch(`${endpoints.iam}${IAM_PATHS.mintKeys}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => null)) as
    | { status?: string; msg?: string; data?: { accessKey?: string } }
    | null;
  if (!res.ok || !body || body.status !== 'ok') {
    throw new ApiKeyError(body?.msg || `Could not mint API key (HTTP ${res.status})`);
  }
  const key = body.data?.accessKey;
  if (!key) throw new ApiKeyError('IAM did not return an access key');
  return key;
}

/** Revoke the signed-in user's `hk-` key (rotates to empty; takes effect ~5m). */
export async function revokeApiKey(accessToken: string): Promise<void> {
  const res = await fetch(`${endpoints.iam}${IAM_PATHS.revokeKeys}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new ApiKeyError(`Could not revoke API key (HTTP ${res.status})`);
}

/**
 * Return a usable `hk-` key: reuse the account's existing one, else mint a new
 * one. Reading first means re-running `hanzo login` does not rotate (and break)
 * a key already wired into the user's coding tools.
 */
export async function ensureApiKey(accessToken: string): Promise<string> {
  const existing = await readApiKey(accessToken).catch(() => undefined);
  return existing ?? mintApiKey(accessToken);
}

/**
 * Single source of truth for Hanzo service endpoints — the same two bases every
 * Hanzo client uses (the `dev` CLI's HANZO_ISSUER/HANZO_CLIENT_ID, the python
 * SDK, this helper):
 *
 *   IAM issuer  identity + keys   default https://hanzo.id/v1/iam
 *   Cloud API   account + models  default https://api.hanzo.ai
 *
 * Everything IAM is issuer-relative (`{iam}/oauth/device`, `{iam}/oauth/token`,
 * `{iam}/mint-user-keys`, `{iam}/revoke-user-keys`). The `/v1/iam` surface is
 * canonical and proxy-stable: it dispatches directly on hanzo.id, and the same
 * relative shape works when IAM is reached bare as `iam.hanzo.ai/v1/iam` or
 * mounted behind the gateway. One base, one way — override it and every IAM op
 * moves together.
 *
 * Overridable for self-hosted / white-label deployments:
 *   HANZO_IAM_URL    e.g. https://lux.id/v1/iam
 *   HANZO_API_URL    e.g. https://api.lux.cloud
 *   HANZO_CLIENT_ID  e.g. lux-app
 */

const env = (key: string, fallback: string): string =>
  process.env[key]?.replace(/\/+$/, '') ?? fallback;

export const endpoints = {
  /** IAM issuer base — device login + per-user key minting live under here. */
  get iam(): string {
    return env('HANZO_IAM_URL', 'https://hanzo.id/v1/iam');
  },
  /** Cloud API — account, models, and OpenAI/Anthropic-compatible inference. */
  get api(): string {
    return env('HANZO_API_URL', 'https://api.hanzo.ai');
  },
} as const;

/** IAM ops, all relative to the issuer base. */
export const IAM_PATHS = {
  deviceAuthorization: '/oauth/device',
  token: '/oauth/token',
  mintKeys: '/mint-user-keys',
  revokeKeys: '/revoke-user-keys',
} as const;

/**
 * OAuth client id the CLI identifies as. `hanzo-app` is the canonical brand
 * CLI/desktop/mobile application seeded in IAM with the device_code grant
 * (iam/cmd/iam/cli/init_apps.go) — the same id the `dev` CLI ships
 * (codex-rs/login/src/auth/manager.rs HANZO_CLIENT_ID). White-label: lux-app, …
 */
export const CLIENT_ID = env('HANZO_CLIENT_ID', 'hanzo-app');

/** Device-code grant type per RFC 8628. */
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

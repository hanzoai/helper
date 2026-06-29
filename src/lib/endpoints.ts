/**
 * Single source of truth for Hanzo service endpoints.
 *
 * Overridable via environment for self-hosted / white-label deployments:
 *   HANZO_IAM_URL   identity SPA (device login)     default https://hanzo.id
 *   HANZO_API_URL   cloud API (keys, inference)      default https://api.hanzo.ai
 *
 * hanzo.id is the Hanzo ID SPA/proxy: it normalizes RFC OAuth paths
 * (/oauth/device, /oauth/token) onto IAM's backend (iam.hanzo.ai /v1/iam/*) and
 * hosts the human-facing approval page (/login/oauth/device). The CLI only ever
 * talks to the public hanzo.id surface.
 */

const env = (key: string, fallback: string): string =>
  process.env[key]?.replace(/\/+$/, '') ?? fallback;

export const endpoints = {
  /** Hanzo ID — device login + approval page live here. */
  get iam(): string {
    return env('HANZO_IAM_URL', 'https://hanzo.id');
  },
  /** Cloud API — API keys, user info, and OpenAI/Anthropic-compatible inference. */
  get api(): string {
    return env('HANZO_API_URL', 'https://api.hanzo.ai');
  },
} as const;

/** RFC 8628 OAuth paths on the Hanzo ID surface. */
export const OAUTH_PATHS = {
  deviceAuthorization: '/oauth/device',
  token: '/oauth/token',
} as const;

/**
 * OAuth client id the CLI identifies as. `hanzo-app` is the canonical brand
 * CLI/desktop application seeded in IAM with the device_code grant (per
 * iam/cmd/iam/cli/init_apps.go). Override for white-label brands (lux-app, …).
 */
export const CLIENT_ID = env('HANZO_CLIENT_ID', 'hanzo-app');

/** Device-code grant type per RFC 8628. */
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

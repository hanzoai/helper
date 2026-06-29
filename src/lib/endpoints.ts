/**
 * Single source of truth for service endpoints — the same two bases every
 * client uses (the `dev` CLI's HANZO_ISSUER/HANZO_CLIENT_ID, the python SDK,
 * this helper):
 *
 *   IAM issuer  identity + keys   default {brand}.id/v1/iam
 *   Cloud API   account + models  default api.{brand}
 *
 * Everything IAM is issuer-relative (`{iam}/oauth/device`, `{iam}/oauth/token`,
 * `{iam}/mint-user-keys`, `{iam}/revoke-user-keys`). The `/v1/iam` surface is
 * canonical and proxy-stable: it dispatches directly on the ID host, and the
 * same relative shape works when IAM is reached bare (iam.{brand}/v1/iam) or
 * mounted behind the gateway (api.{brand}/v1/iam). One base, one way.
 *
 * Defaults come from the active brand (see brand.ts); explicit env vars always
 * win, so any deployment can be pointed anywhere:
 *   HANZO_IAM_URL    e.g. https://lux.id/v1/iam
 *   HANZO_API_URL    e.g. https://api.lux.network
 *   HANZO_CLIENT_ID  e.g. lux-app
 */

import { brand } from './brand';

const env = (key: string, fallback: string): string =>
  process.env[key]?.replace(/\/+$/, '') ?? fallback;

export const endpoints = {
  /** IAM issuer base — device login + per-user key minting live under here. */
  get iam(): string {
    return env('HANZO_IAM_URL', brand.iam);
  },
  /** Cloud API — account, models, and OpenAI/Anthropic-compatible inference. */
  get api(): string {
    return env('HANZO_API_URL', brand.api);
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
 * OAuth client id the CLI identifies as. The brand default is the canonical
 * CLI/desktop/mobile application seeded in IAM with the device_code grant
 * (iam/cmd/iam/cli/init_apps.go) — the same id the `dev` CLI ships
 * (codex-rs/login/src/auth/manager.rs HANZO_CLIENT_ID).
 */
export const CLIENT_ID = env('HANZO_CLIENT_ID', brand.clientId);

/** Device-code grant type per RFC 8628. */
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

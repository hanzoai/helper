/**
 * Hanzo IAM device-authorization flow (RFC 8628).
 *
 * The CLI cannot show a browser, so it asks IAM for a short user code, tells
 * the user where to enter it, and polls until they approve. No local callback
 * server, no client secret — exactly what a coding-tool installer needs.
 */

import { endpoints, IAM_PATHS, CLIENT_ID, DEVICE_GRANT_TYPE } from './endpoints';
import type { UserInfo } from './config';

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export class DeviceAuthError extends Error {}

/**
 * IAM reads device-grant parameters via Beego `Query()` — from the query string
 * or form body, never JSON (iam controllers/token.go GetOAuthToken skips JSON
 * for the device_code grant). We match the `dev` CLI exactly: device
 * authorization carries its params in the query string, token exchange in the
 * form body.
 */
function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** Step 1: ask IAM to start a device-authorization request (RFC 8628). */
export async function requestDeviceCode(): Promise<DeviceCode> {
  const url = new URL(`${endpoints.iam}${IAM_PATHS.deviceAuthorization}`);
  url.search = form({
    client_id: CLIENT_ID,
    scope: 'openid profile email',
    response_type: 'device_code',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    throw new DeviceAuthError(`Could not start login (${res.status} ${res.statusText})`);
  }

  const d = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    expires_in?: number;
    interval?: number;
  };

  const verificationUri = d.verification_uri ?? `${endpoints.iam}/login/oauth/device`;
  return {
    deviceCode: d.device_code,
    userCode: d.user_code,
    verificationUri,
    verificationUriComplete:
      d.verification_uri_complete ?? `${verificationUri}?user_code=${d.user_code}`,
    expiresIn: d.expires_in ?? 300,
    interval: d.interval ?? 5,
  };
}

export interface DeviceTokens {
  accessToken: string;
}

/**
 * Step 2: poll the token endpoint until the user approves, the code expires,
 * or the request is denied. Honors `authorization_pending` and `slow_down`
 * backoff signals per the spec. Calls `onTick` once per poll for UI feedback.
 */
export async function pollForToken(
  dc: DeviceCode,
  onTick?: (secondsLeft: number) => void
): Promise<DeviceTokens> {
  let interval = dc.interval;
  const deadline = Date.now() + dc.expiresIn * 1000;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    onTick?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));

    const res = await fetch(`${endpoints.iam}${IAM_PATHS.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        client_id: CLIENT_ID,
        device_code: dc.deviceCode,
        grant_type: DEVICE_GRANT_TYPE,
      }),
    });

    // IAM (Casdoor) returns the OAuth body with the matching HTTP status: 200 +
    // {access_token} on approval, 400 + {error} while pending/denied. We key off
    // the body so a status-rewriting proxy can't desync us.
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
    };

    if (body.access_token) return { accessToken: body.access_token };

    switch (body.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        interval += 5;
        continue;
      case 'access_denied':
        throw new DeviceAuthError('Login was denied.');
      case 'expired_token':
        throw new DeviceAuthError('Login code expired. Please run `hanzo login` again.');
      case undefined:
        throw new DeviceAuthError(`Login failed (${res.status} ${res.statusText})`);
      default:
        throw new DeviceAuthError(`Login failed: ${body.error}`);
    }
  }

  throw new DeviceAuthError('Login timed out. Please run `hanzo login` again.');
}

/**
 * Fetch the signed-in user's identity from IAM's get-account
 * (…/v1/iam/get-account, controllers/account.go GetAccount). The response is a
 * { status, sub, name, data, data2 } envelope: the full account (email, owner,
 * displayName, …) is under `data`, the org under `data2`. Accepts the
 * device-login bearer token via the auto-signin filter.
 */
export async function fetchUser(accessToken: string): Promise<UserInfo> {
  const res = await fetch(`${endpoints.iam}${IAM_PATHS.account}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new DeviceAuthError(`Could not fetch profile (${res.status} ${res.statusText})`);
  }
  const body = (await res.json()) as {
    sub?: string;
    name?: string;
    data?: { id?: string; name?: string; displayName?: string; email?: string; owner?: string };
  };
  const u = body.data ?? {};
  const owner = u.owner;
  return {
    id: u.id ?? body.sub ?? '',
    name: u.displayName ?? u.name ?? body.name ?? u.email ?? 'unknown',
    email: u.email ?? '',
    ...(owner ? { org: owner } : {}),
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

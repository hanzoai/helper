#!/usr/bin/env node
/**
 * @luxfi/helper — the Lux-branded build of @hanzo/helper.
 *
 * Same engine, Lux defaults. We set the brand before importing the CLI so the
 * shared code resolves lux.id / api.lux.network / lux-app. Any explicit
 * HANZO_IAM_URL / HANZO_API_URL / HANZO_CLIENT_ID still overrides.
 */
process.env.HANZO_BRAND ??= 'lux';
await import('@hanzo/helper/dist/cli.js');

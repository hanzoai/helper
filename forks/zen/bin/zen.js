#!/usr/bin/env node
/**
 * @zenlm/helper — the Zen-branded build of @hanzo/helper.
 *
 * Same engine, Zen defaults. We set the brand before importing the CLI so the
 * shared code resolves zen.id / api.zenlm.org / zen-app. Any explicit
 * HANZO_IAM_URL / HANZO_API_URL / HANZO_CLIENT_ID still overrides.
 */
process.env.HANZO_BRAND ??= 'zen';
await import('@hanzo/helper/dist/cli.js');

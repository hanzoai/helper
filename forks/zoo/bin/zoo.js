#!/usr/bin/env node
/**
 * @zooai/helper — the Zoo-branded build of @hanzo/helper.
 *
 * Same engine, Zoo defaults. We set the brand before importing the CLI so the
 * shared code resolves zoolabs.id / api.zoo.ngo / zoo-app. Any explicit
 * HANZO_IAM_URL / HANZO_API_URL / HANZO_CLIENT_ID still overrides.
 */
process.env.HANZO_BRAND ??= 'zoo';
await import('@hanzo/helper/cli');

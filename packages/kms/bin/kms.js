#!/usr/bin/env node
/**
 * @hanzo/kms — the standalone `kms` command.
 *
 * One implementation: it runs @hanzo/helper's kms CLI (which is also reachable
 * as `hanzo kms`). Installing this package gives you `kms` on its own; the
 * engine, auth, and token store are shared with `hanzo`.
 */
await import('@hanzo/helper/kms-cli');

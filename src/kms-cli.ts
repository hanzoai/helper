#!/usr/bin/env node
/**
 * Standalone `kms` command — the same `hanzo kms` subcommand, surfaced as its
 * own binary so `kms pull --env devnet` works directly. One implementation
 * (commands/kms.ts), two entry points.
 */

import { kmsCmd } from './commands/kms';
import { version } from './lib/version';

kmsCmd.name('kms').version(version);
await kmsCmd.parseAsync(process.argv);

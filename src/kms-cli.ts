#!/usr/bin/env node
/**
 * Standalone `kms` command — pull environment secrets for local dev.
 *
 * Self-sufficient: `kms login` signs in via IAM (the same device flow and the
 * same ~/.hanzo/config.json token store as `hanzo login`), so `kms pull` works
 * whether you signed in through `kms` or `hanzo`. One flow, one token store.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { kmsCmd } from './commands/kms';
import { deviceSignIn } from './lib/signin';
import { version } from './lib/version';

const program = new Command('kms')
  .description('KMS secrets for local dev — sign in with IAM, pull an env into .env')
  .version(version);

program
  .command('login')
  .description('Sign in with IAM (device login) — shared with `hanzo login`')
  .option('--no-browser', 'Do not open the browser automatically')
  .action(async (opts: { browser: boolean }) => {
    try {
      await deviceSignIn(opts.browser);
      console.log(chalk.green('  ✓ Signed in. Try: kms pull --env devnet'));
    } catch (err) {
      console.error(chalk.red(`\n✗ ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

// The pull/list subcommands, surfaced directly under `kms`.
for (const sub of kmsCmd.commands) program.addCommand(sub);

await program.parseAsync(process.argv);

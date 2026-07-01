/**
 * `hanzo kms` (also installed as the standalone `kms` command) — pull
 * environment secrets from KMS for local dev, using your existing IAM login.
 *
 *   kms pull [--env devnet] [--org <org>] [--out .env]   write a dotenv file
 *   kms list [--env devnet] [--org <org>]                names only (no values)
 *
 * Auth is your `hanzo login` session — one login, one token store. Your org
 * comes from that login (override with --org). KMS decides what you may read
 * per env; this is just the client.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import { getConfig } from '../lib/config';
import { listSecrets, pullSecrets, KMS_ENVS, KMS_PROD_ENVS, KmsError } from '../lib/kms';

const DEFAULT_ENV = 'devnet';

export const kmsCmd = new Command('kms')
  .description('Pull environment secrets from KMS for local dev (uses your hanzo login)');

kmsCmd
  .command('pull')
  .description('Fetch secrets for an environment and write a dotenv file')
  .option('--env <env>', `Environment: ${KMS_ENVS.join(', ')}`, DEFAULT_ENV)
  .option('--org <org>', 'Organization (defaults to your signed-in org)')
  .option('--out <file>', 'Output dotenv file (use "-" for stdout)', '.env')
  .action(async (opts: { env: string; org?: string; out: string }) => {
    const { token, org } = await session(opts.org);
    const secrets = await run(`Reading ${opts.env} secrets…`, () => pullSecrets(token, org, opts.env));
    const body = toDotenv(secrets);

    if (opts.out === '-') {
      process.stdout.write(body);
      return;
    }
    if (KMS_PROD_ENVS.has(opts.env)) {
      console.log(chalk.yellow(`  ! ${opts.env} secrets — handle with care; do not commit ${opts.out}.`));
    }
    fs.writeFileSync(opts.out, body, { mode: 0o600 });
    console.log(chalk.green(`  ✓ Wrote ${Object.keys(secrets).length} secrets to ${opts.out} (${org}/${opts.env})`));
  });

kmsCmd
  .command('list')
  .description('List secret names for an environment (no values)')
  .option('--env <env>', `Environment: ${KMS_ENVS.join(', ')}`, DEFAULT_ENV)
  .option('--org <org>', 'Organization (defaults to your signed-in org)')
  .action(async (opts: { env: string; org?: string }) => {
    const { token, org } = await session(opts.org);
    const metas = await run(`Listing ${opts.env} secrets…`, () => listSecrets(token, org, opts.env));
    for (const m of metas.map((s) => s.name).sort()) console.log(`  ${m}`);
    console.log(chalk.dim(`\n  ${metas.length} secrets in ${org}/${opts.env}`));
  });

/** Resolve the IAM token + org from the login session (org overridable). */
async function session(orgOverride?: string): Promise<{ token: string; org: string }> {
  const cfg = await getConfig();
  if (!cfg.accessToken) {
    console.error(chalk.red('Not signed in. Run `kms login` (or `hanzo login`) first.'));
    process.exit(1);
  }
  const org = orgOverride ?? cfg.user?.org;
  if (!org) {
    console.error(chalk.red('No organization found. Pass --org <org> or run `hanzo login` again.'));
    process.exit(1);
  }
  return { token: cfg.accessToken, org };
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (err) {
    spinner.fail(chalk.red(err instanceof KmsError || err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

/** Render a key→value map as a dotenv file, quoting only when needed. */
function toDotenv(secrets: Record<string, string>): string {
  return (
    Object.keys(secrets)
      .sort()
      .map((k) => `${k}=${quote(secrets[k]!)}`)
      .join('\n') + '\n'
  );
}

function quote(v: string): string {
  return /[\s"'#=]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}

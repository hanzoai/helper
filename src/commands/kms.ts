/**
 * `hanzo kms` (also installed as the standalone `kms` command) — pull
 * environment secrets from KMS for local dev, using your existing IAM login.
 *
 *   kms pull [--env devnet] [--path /] [--out .env]   write a dotenv file
 *   kms list [--env devnet] [--path /]                names only (no values)
 *
 * Auth is your `hanzo login` session — one login, one token store. KMS decides
 * what you may read per env; this is just the client.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import { getConfig } from '../lib/config';
import { pullSecrets, KMS_ENVS, KMS_PROD_ENVS, KmsError } from '../lib/kms';

const DEFAULT_ENV = 'devnet';

export const kmsCmd = new Command('kms')
  .description('Pull environment secrets from KMS for local dev (uses your hanzo login)');

kmsCmd
  .command('pull')
  .description('Fetch secrets for an environment and write a dotenv file')
  .option('--env <env>', `Environment: ${KMS_ENVS.join(', ')}`, DEFAULT_ENV)
  .option('--path <path>', 'Secret path', '/')
  .option('--out <file>', 'Output dotenv file (use "-" for stdout)', '.env')
  .action(async (opts: { env: string; path: string; out: string }) => {
    const secrets = await fetchOrExit(opts.env, opts.path);
    const body = toDotenv(secrets);

    if (opts.out === '-') {
      process.stdout.write(body);
      return;
    }
    if (KMS_PROD_ENVS.has(opts.env)) {
      console.log(chalk.yellow(`  ! ${opts.env} secrets — handle with care; do not commit ${opts.out}.`));
    }
    fs.writeFileSync(opts.out, body, { mode: 0o600 });
    console.log(chalk.green(`  ✓ Wrote ${Object.keys(secrets).length} secrets to ${opts.out} (${opts.env})`));
  });

kmsCmd
  .command('list')
  .description('List secret names for an environment (no values)')
  .option('--env <env>', `Environment: ${KMS_ENVS.join(', ')}`, DEFAULT_ENV)
  .option('--path <path>', 'Secret path', '/')
  .action(async (opts: { env: string; path: string }) => {
    const secrets = await fetchOrExit(opts.env, opts.path);
    for (const k of Object.keys(secrets).sort()) console.log(`  ${k}`);
    console.log(chalk.dim(`\n  ${Object.keys(secrets).length} secrets in ${opts.env}`));
  });

async function fetchOrExit(env: string, path: string): Promise<Record<string, string>> {
  const { accessToken } = await getConfig();
  if (!accessToken) {
    console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
    process.exit(1);
  }
  const spinner = ora(`Reading ${env} secrets…`).start();
  try {
    const secrets = await pullSecrets(accessToken, env, path);
    spinner.stop();
    return secrets;
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

/**
 * `hanzo auth` — inspect or clear the saved session, and manage the `hk-` key.
 *
 * Hanzo issues ONE per-user Cloud API key (the IAM accessKey). There is no list
 * of named keys; you read it, rotate it, or revoke it.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, setConfig, clearConfig } from '../lib/config';
import { readApiKey, mintApiKey, revokeApiKey } from '../lib/apikeys';
import { maskKey } from '../targets';

export const authCmd = new Command('auth').description('Manage your Hanzo session and API key');

authCmd
  .command('status')
  .description('Show who you are signed in as')
  .action(async () => {
    const { user, apiKey, accessToken } = await getConfig();
    if (!apiKey && !accessToken) {
      console.log(chalk.yellow('Not signed in. Run `hanzo login`.'));
      process.exit(1);
    }
    console.log(chalk.green('✓ Signed in'));
    if (user) {
      console.log(chalk.dim(`  ${user.name}${user.email ? ` <${user.email}>` : ''}`));
      if (user.org) console.log(chalk.dim(`  org: ${user.org}`));
    }
    if (apiKey) console.log(chalk.dim(`  key: ${maskKey(apiKey)}`));
  });

authCmd
  .command('logout')
  .description('Forget the saved session and API key (local only)')
  .action(async () => {
    await clearConfig();
    console.log(chalk.green('✓ Signed out (local credentials cleared)'));
  });

authCmd
  .command('key')
  .description('Show your current Cloud API key')
  .option('--reveal', 'Print the full key instead of a masked form')
  .action(async (opts: { reveal?: boolean }) => {
    const token = await requireToken();
    const spinner = ora('Reading key…').start();
    try {
      const key = await readApiKey(token);
      spinner.stop();
      if (!key) {
        console.log(chalk.yellow('No API key yet. Create one with `hanzo auth rotate`.'));
        return;
      }
      console.log(opts.reveal ? key : maskKey(key));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

authCmd
  .command('rotate')
  .description('Mint a fresh Cloud API key (the old one stops working)')
  .action(async () => {
    const token = await requireToken();
    const spinner = ora('Minting key…').start();
    try {
      const key = await mintApiKey(token);
      await setConfig((c) => ({ ...c, apiKey: key }));
      spinner.succeed(chalk.green('New API key minted'));
      console.log(chalk.bold(key));
      console.log(chalk.dim('Saved locally and shown once. Re-run `hanzo use` to update your tools.'));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

authCmd
  .command('revoke')
  .description('Revoke your Cloud API key')
  .action(async () => {
    const token = await requireToken();
    try {
      await revokeApiKey(token);
      await setConfig((c) => ({ ...c, apiKey: undefined }));
      console.log(chalk.green('✓ API key revoked'));
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

async function requireToken(): Promise<string> {
  const { accessToken } = await getConfig();
  if (!accessToken) {
    console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
    process.exit(1);
  }
  return accessToken;
}

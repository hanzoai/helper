/**
 * `hanzo status` — one screen showing the session and every coding tool's state.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config';
import { endpoints } from '../lib/endpoints';
import { TARGETS, maskKey } from '../targets';

export const statusCmd = new Command('status')
  .description('Show session and coding-tool configuration')
  .action(async () => {
    const { user, apiKey } = await getConfig();

    console.log(chalk.bold('\n  Session'));
    if (apiKey) {
      console.log(`  ${chalk.green('●')} signed in${user ? ` as ${user.name}` : ''}`);
      console.log(chalk.dim(`    key  ${maskKey(apiKey)}`));
      console.log(chalk.dim(`    api  ${endpoints.api}`));
    } else {
      console.log(`  ${chalk.yellow('○')} not signed in — run ${chalk.cyan('hanzo login')}`);
    }

    console.log(chalk.bold('\n  Coding tools'));
    for (const t of TARGETS) {
      const s = t.status();
      const dot = s.configured ? chalk.green('●') : s.installed ? chalk.yellow('○') : chalk.dim('○');
      const state = s.configured
        ? chalk.green('using Hanzo')
        : s.installed
          ? chalk.yellow('installed, not configured')
          : chalk.dim('not installed');
      console.log(`  ${dot} ${t.displayName.padEnd(14)} ${state}`);
    }
    console.log();
  });

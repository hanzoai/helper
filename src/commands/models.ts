/**
 * `hanzo models` — list models available through Hanzo Cloud for your key.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../lib/config';
import { fetchModels, FEATURED_MODELS } from '../lib/models';

export const modelsCmd = new Command('models')
  .description('List models available through Hanzo Cloud')
  .option('--featured', 'Show only the curated featured set')
  .action(async (opts: { featured?: boolean }) => {
    if (opts.featured) {
      for (const m of FEATURED_MODELS) console.log(`  ${chalk.bold(m.id.padEnd(20))} ${chalk.dim(m.label)}`);
      return;
    }

    const { apiKey } = await getConfig();
    if (!apiKey) {
      console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching models…').start();
    try {
      const ids = await fetchModels(apiKey);
      spinner.stop();
      for (const id of ids) console.log(`  ${id}`);
      console.log(chalk.dim(`\n  ${ids.length} models`));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

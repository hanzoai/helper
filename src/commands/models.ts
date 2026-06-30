/**
 * `hanzo models` — list models available through Hanzo Cloud for your key.
 * Everything is read live from api.hanzo.ai; nothing is hardcoded.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../lib/config';
import { fetchCatalog, aliasesFrom, EFFORT_ALIASES, EFFORT_ORDER } from '../lib/models';

export const modelsCmd = new Command('models')
  .description('List models available through Hanzo Cloud')
  .option('--tiers', 'Show the smart tiers (effort words → cloud routing aliases)')
  .action(async (opts: { tiers?: boolean }) => {
    const { apiKey } = await getConfig();
    if (!apiKey) {
      console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching models…').start();
    let catalog;
    try {
      catalog = await fetchCatalog(apiKey);
      spinner.stop();
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    if (opts.tiers) {
      const live = new Set(aliasesFrom(catalog).map((a) => a.id));
      console.log(chalk.bold('  Smart tiers — the cloud picks the best model:\n'));
      for (const word of EFFORT_ORDER) {
        const alias = EFFORT_ALIASES[word]!;
        const ok = live.has(alias) ? chalk.green('●') : chalk.dim('○');
        console.log(`  ${ok} ${chalk.bold(word.padEnd(7))} → ${alias}`);
      }
      console.log(chalk.dim('\n  Use anywhere a model is asked for: `hanzo use --model high`'));
      console.log(chalk.dim('  ● = live in your catalog. The alias is a real id; the cloud routes it.'));
      return;
    }

    const pad = Math.max(...catalog.map((m) => m.id.length));
    for (const m of catalog) {
      const tag = m.premium ? chalk.yellow(' needs credits') : '';
      console.log(`  ${m.id.padEnd(pad)}  ${chalk.dim(m.ownedBy)}${tag}`);
    }
    console.log(chalk.dim(`\n  ${catalog.length} models`));
  });

/**
 * `hanzo models [name]` — the live model catalog for your key.
 *   (no args)      rich table of the models you can call (price, context, tier)
 *   --all          include models not yet enabled for your key
 *   --tiers        the smart tiers (effort words → cloud routing aliases)
 *   <name>         full detail for one model (specs, pricing, features)
 *
 * Rich fields come from the public pricing catalog (pricing.<brand>/v1/pricing/
 * models) joined with your live routing set — the same source the console shows.
 * Nothing is hardcoded; if the catalog is unreachable we fall back to the plain
 * id list rather than invent data.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { getConfig } from '../lib/config';
import {
  fetchCatalog,
  fetchRichCatalog,
  fetchJoinedCatalog,
  findModel,
  aliasesFrom,
  EFFORT_ALIASES,
  EFFORT_ORDER,
  type RichEntry,
  type RichModel,
} from '../lib/models';

export const modelsCmd = new Command('models')
  .description('List models available through Hanzo Cloud')
  .argument('[name]', 'Show full detail for one model')
  .option('--all', 'Include models not yet enabled for your key')
  .option('--tiers', 'Show the smart tiers (effort words → cloud routing aliases)')
  .action(async (name: string | undefined, opts: { all?: boolean; tiers?: boolean }) => {
    const { apiKey } = await getConfig();
    if (!apiKey) {
      console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
      process.exit(1);
    }

    if (name) return showDetail(name);
    if (opts.tiers) return showTiers(apiKey);

    const spinner = ora('Fetching catalog…').start();
    try {
      const entries = await fetchJoinedCatalog(apiKey);
      spinner.stop();
      renderTable(opts.all ? entries : entries.filter((e) => e.available));
    } catch {
      // Pricing catalog unreachable — fall back to the plain routing list.
      try {
        const plain = await fetchCatalog(apiKey);
        spinner.stop();
        for (const m of plain) {
          const tag = m.premium ? chalk.yellow(' needs credits') : '';
          console.log(`  ${m.id}  ${chalk.dim(m.ownedBy)}${tag}`);
        }
        console.log(chalk.dim(`\n  ${plain.length} models`));
      } catch (err) {
        spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    }
  });

function renderTable(rows: RichEntry[]): void {
  if (rows.length === 0) {
    console.log(chalk.yellow('  No models. Try --all, or add credits at console.hanzo.ai.'));
    return;
  }
  const table = new Table({
    head: ['Model', 'Provider', 'Tier', 'Context', 'In $/M', 'Out $/M'].map((h) => chalk.dim(h)),
    style: { head: [], border: [] },
  });
  for (const m of rows) {
    const name = m.available ? m.routeId : chalk.dim(m.routeId);
    table.push([
      name,
      m.provider ?? '',
      m.tier ?? '',
      fmtContext(m.context),
      fmtPrice(m.pricing?.input),
      fmtPrice(m.pricing?.output),
    ]);
  }
  console.log(table.toString());
  const callable = rows.filter((r) => r.available).length;
  console.log(chalk.dim(`\n  ${rows.length} shown · ${callable} callable with your key`));
  console.log(chalk.dim('  `hanzo models <name>` for full detail · `--all` for the whole catalog'));
}

async function showDetail(name: string): Promise<void> {
  const spinner = ora('Looking up model…').start();
  let catalog: RichModel[];
  try {
    catalog = await fetchRichCatalog();
    spinner.stop();
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
  const m = findModel(catalog, name);
  if (!m) {
    console.error(chalk.red(`No model "${name}" in the catalog. Try \`hanzo models\`.`));
    process.exit(1);
  }
  const line = (label: string, value?: string) =>
    value ? console.log(`  ${chalk.dim(label.padEnd(10))} ${value}`) : undefined;

  const subtitle = m.id ?? m.name;
  console.log();
  console.log(`  ${chalk.bold(m.fullName ?? m.name)}${subtitle !== (m.fullName ?? m.name) ? `  ${chalk.dim(subtitle)}` : ''}`);
  if (m.description) console.log(chalk.dim(`  ${m.description}`));
  console.log();
  line('Provider', m.provider);
  line('Tier', m.tier);
  line('Context', fmtContext(m.context) || undefined);
  line('Params', m.specs?.params);
  line('Arch', m.specs?.arch);
  const p = m.pricing;
  if (p && (p.input != null || p.output != null)) {
    const parts = [`in ${fmtPrice(p.input)}`, `out ${fmtPrice(p.output)}`];
    if (p.cacheRead != null) parts.push(`cache-read ${fmtPrice(p.cacheRead)}`);
    line('Pricing', `${parts.join('  ')}  ${chalk.dim('per Mtok')}`);
  }
  if (m.features?.length) line('Features', m.features.join(', '));
}

async function showTiers(apiKey: string): Promise<void> {
  const spinner = ora('Fetching models…').start();
  let live: Set<string>;
  try {
    live = new Set(aliasesFrom(await fetchCatalog(apiKey)).map((a) => a.id));
    spinner.stop();
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
  console.log(chalk.bold('  Smart tiers — the cloud picks the best model:\n'));
  for (const word of EFFORT_ORDER) {
    const alias = EFFORT_ALIASES[word]!;
    const ok = live.has(alias) ? chalk.green('●') : chalk.dim('○');
    console.log(`  ${ok} ${chalk.bold(word.padEnd(7))} → ${alias}`);
  }
  console.log(chalk.dim('\n  Use anywhere a model is asked for: `hanzo use --model high`'));
  console.log(chalk.dim('  ● = live in your catalog. The alias is a real id; the cloud routes it.'));
}

function fmtContext(ctx?: number | null): string {
  if (!ctx) return '';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 ? 1 : 0)}M`;
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
  return String(ctx);
}

function fmtPrice(v?: number | null): string {
  if (v == null) return chalk.dim('—');
  if (v === 0) return chalk.green('free');
  return `$${v.toFixed(2)}`;
}

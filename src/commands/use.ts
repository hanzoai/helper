/**
 * `hanzo use <tool>` / `hanzo unuse <tool>` — point an already-installed coding
 * tool at Hanzo (or detach it) using the API key saved by `hanzo login`.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config';
import { endpoints } from '../lib/endpoints';
import { DEFAULT_MODEL } from '../lib/models';
import { TARGETS, getTarget, codexEnvHint } from '../targets';

export const useCmd = new Command('use')
  .description('Point a coding tool at Hanzo using your saved API key')
  .argument('[tool]', 'Tool id (claude-code, codex). Omit to apply to all installed tools.')
  .option('--model <id>', 'Default model to use', DEFAULT_MODEL)
  .action(async (tool: string | undefined, opts: { model: string }) => {
    const { apiKey } = await getConfig();
    if (!apiKey) {
      console.error(chalk.red('Not signed in. Run `hanzo login` first.'));
      process.exit(1);
    }

    const targets = tool ? [requireTarget(tool)] : TARGETS.filter((t) => t.status().installed);
    if (targets.length === 0) {
      console.log(chalk.yellow('No installed coding tools found.'));
      return;
    }

    const creds = { apiKey, apiBase: endpoints.api, model: opts.model };
    for (const t of targets) {
      t.configure(creds);
      console.log(chalk.green(`✓ ${t.displayName} → Hanzo Cloud (${opts.model})`));
      if (t.id === 'codex') console.log(chalk.dim(`  ${codexEnvHint()}`));
    }
  });

export const unuseCmd = new Command('unuse')
  .description('Detach a coding tool from Hanzo (restore its other settings)')
  .argument('[tool]', 'Tool id (claude-code, codex). Omit to detach all.')
  .action(async (tool: string | undefined) => {
    const targets = tool ? [requireTarget(tool)] : [...TARGETS];
    for (const t of targets) {
      if (!t.status().configured) continue;
      t.unconfigure();
      console.log(chalk.green(`✓ ${t.displayName} detached from Hanzo`));
    }
  });

function requireTarget(id: string) {
  const t = getTarget(id);
  if (!t) {
    console.error(
      chalk.red(`Unknown tool: ${id}. Try one of: ${TARGETS.map((x) => x.id).join(', ')}`)
    );
    process.exit(1);
  }
  return t;
}

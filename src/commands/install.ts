/**
 * `hanzo install [components...]` — set up the Hanzo ecosystem.
 *   no args, interactive → pick from a checklist (core tools pre-checked)
 *   no args, non-interactive → install the core tools (dev, mcp)
 *   named → install exactly those
 *   `hanzo install list` → show everything available
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  COMPONENTS,
  getComponent,
  installComponents,
  pickComponents,
  type Component,
} from '../lib/ecosystem';

export const installCmd = new Command('install')
  .description('Install Hanzo tooling (dev, mcp, node, desktop, extension, ide, slack, github)')
  .argument('[components...]', 'Which to install; omit to choose from a checklist')
  .action(async (ids: string[]) => {
    const chosen = ids.length > 0 ? resolveIds(ids) : await pickComponents();
    await installComponents(chosen);
    if (chosen.length > 0) console.log(chalk.dim('\n  Done. `hanzo install list` shows the rest.'));
  });

installCmd
  .command('list')
  .description('List installable Hanzo ecosystem components')
  .action(() => {
    for (const c of COMPONENTS) {
      const kind = c.kind === 'npm' ? chalk.green('npm  ') : chalk.blue('guide');
      console.log(`  ${chalk.bold(c.id.padEnd(10))} ${kind}  ${chalk.dim(c.desc)}`);
    }
  });

function resolveIds(ids: string[]): Component[] {
  const out: Component[] = [];
  for (const id of ids) {
    const c = getComponent(id);
    if (!c) {
      console.error(chalk.red(`Unknown component: ${id}. Try: ${COMPONENTS.map((x) => x.id).join(', ')}`));
      continue;
    }
    out.push(c);
  }
  return out;
}

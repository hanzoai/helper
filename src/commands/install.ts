/**
 * `hanzo install` — install Hanzo's own tooling.
 *   @hanzo/dev        CLI coding agent (run `hanzo dev` after)
 *   @hanzo/mcp        Model Context Protocol server (tools, browser, cloud)
 *   @hanzo/extension  browser extension (manual install — link printed)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'node:child_process';

interface Pkg {
  id: string;
  pkg: string;
  desc: string;
  /** Browser extensions can't be `npm i -g`'d into a usable state. */
  manual?: boolean;
}

const PACKAGES: Record<string, Pkg> = {
  dev: { id: 'dev', pkg: '@hanzo/dev', desc: 'Hanzo Dev — CLI coding agent' },
  mcp: { id: 'mcp', pkg: '@hanzo/mcp', desc: 'Hanzo MCP — tools, browser, cloud' },
  extension: { id: 'extension', pkg: '@hanzo/extension', desc: 'Hanzo Browser Extension', manual: true },
};

export const installCmd = new Command('install')
  .description('Install Hanzo tooling (dev, mcp, extension)')
  .argument('[packages...]', 'Which to install; omit for dev + mcp')
  .action(async (ids: string[]) => {
    const chosen = ids.length > 0 ? ids : ['dev', 'mcp'];
    for (const id of chosen) {
      const p = PACKAGES[id];
      if (!p) {
        console.error(chalk.red(`Unknown package: ${id}. Try: ${Object.keys(PACKAGES).join(', ')}`));
        continue;
      }
      if (p.manual) {
        printExtensionHelp();
        continue;
      }
      await npmInstallGlobal(p);
    }
  });

installCmd
  .command('list')
  .description('List installable Hanzo packages')
  .action(() => {
    for (const p of Object.values(PACKAGES)) {
      console.log(`  ${chalk.bold(p.id.padEnd(10))} ${p.pkg.padEnd(18)} ${chalk.dim(p.desc)}`);
    }
  });

function npmInstallGlobal(p: Pkg): Promise<void> {
  const spinner = ora(`Installing ${p.desc}…`).start();
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', p.pkg], { stdio: 'pipe' });
    child.stderr?.on('data', (d) => (spinner.text = String(d).trim().slice(0, 60)));
    child.on('close', (code) => {
      if (code === 0) spinner.succeed(chalk.green(`${p.desc} installed`));
      else spinner.fail(chalk.red(`Failed to install ${p.pkg} (exit ${code})`));
      resolve();
    });
    child.on('error', (e) => {
      spinner.fail(chalk.red(`Failed to install ${p.pkg}: ${e.message}`));
      resolve();
    });
  });
}

function printExtensionHelp(): void {
  console.log(chalk.bold('\n  Hanzo Browser Extension'));
  console.log(chalk.dim('  Chrome  : chrome://extensions → Developer Mode → Load Unpacked'));
  console.log(chalk.dim('  Firefox : about:debugging → This Firefox → Load Temporary Add-on'));
  console.log(chalk.dim('  Download: https://hanzo.ai/extension\n'));
}

/**
 * The Hanzo ecosystem — one registry, one installer. Every component the helper
 * can set up (CLI agents, MCP, the node/engine, the desktop app + Enso browser,
 * browser/IDE extensions, the Slack and GitHub apps) is one data entry here.
 *
 * Two install shapes, nothing more:
 *   • npm    — a global package we can install directly (`@hanzo/dev`, …).
 *   • guide  — an app/extension installed through a hosted flow; we open the
 *              canonical page and print the steps. URLs hang off the brand's web
 *              root, so the Lux/Zoo/Zen forks get the right links for free.
 *
 * Add a component by appending to COMPONENTS — the command, the wizard, and
 * `install list` all pick it up with no other change.
 */

import { spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { brand } from './brand';
import { openUrl } from './open';

export type ComponentKind = 'npm' | 'guide';

export interface Component {
  /** Stable id used on the command line. */
  id: string;
  /** Short human label. */
  label: string;
  /** One-line description. */
  desc: string;
  kind: ComponentKind;
  /** Part of the default "core tooling" set installed when none is named. */
  core?: boolean;
  /** npm: the global package to install. */
  pkg?: string;
  /** npm: what you run afterwards. */
  run?: string;
  /** guide: canonical page to open. */
  url?: string;
  /** guide: the steps to print. */
  steps?: string[];
}

const site = brand.site;

export const COMPONENTS: readonly Component[] = [
  {
    id: 'dev',
    label: `${brand.name} Dev`,
    desc: 'CLI coding agent (installs the `code` command)',
    kind: 'npm',
    core: true,
    pkg: '@hanzo/dev',
    run: 'code',
  },
  {
    id: 'mcp',
    label: `${brand.name} MCP`,
    desc: 'Model Context Protocol server — tools, browser, and cloud for any MCP client',
    kind: 'npm',
    core: true,
    pkg: '@hanzo/mcp',
    run: 'hanzo-mcp',
  },
  {
    id: 'node',
    label: `${brand.name} Node`,
    desc: 'Local inference node (bundles the engine) for running models on your own hardware',
    kind: 'guide',
    url: `${site}/download`,
    steps: [
      'Download the node for your platform from the link above.',
      'Run it once to start the local engine (serves an OpenAI-compatible API).',
      'Point a tool at it with `hanzo use --model <id>` once it is running.',
    ],
  },
  {
    id: 'desktop',
    label: `${brand.name} Desktop & Enso`,
    desc: 'Desktop app and the Enso browser — chat, agents, and the engine in one place',
    kind: 'guide',
    url: `${site}/download`,
    steps: [
      'Download the desktop app / Enso browser for your platform.',
      `Sign in with the same ${brand.name} account — your models and keys carry over.`,
    ],
  },
  {
    id: 'extension',
    label: `${brand.name} Browser Extension`,
    desc: 'Browser extension (Chrome, Firefox, Safari) — page context and actions for agents',
    kind: 'guide',
    url: `${site}/extension`,
    steps: [
      'Install from your browser store via the link above, or load it unpacked:',
      `  Chrome  → chrome://extensions → Developer Mode → Load Unpacked`,
      `  Firefox → about:debugging → This Firefox → Load Temporary Add-on`,
    ],
  },
  {
    id: 'ide',
    label: `${brand.name} for your IDE`,
    desc: 'VS Code and JetBrains extensions',
    kind: 'guide',
    url: `${site}/docs/ide`,
    steps: [
      'VS Code   → search "Hanzo" in the Extensions marketplace.',
      'JetBrains → search "Hanzo" in Settings → Plugins → Marketplace.',
      'Sign in with your API key (saved by `hanzo login`) when prompted.',
    ],
  },
  {
    id: 'slack',
    label: `${brand.name} for Slack`,
    desc: 'Add the Slack app to chat with agents and run tools from your workspace',
    kind: 'guide',
    url: `${site}/slack`,
    steps: [
      'Open the link and click Add to Slack; approve the workspace permissions.',
      `Then type /${brand.bin} in any channel to start.`,
    ],
  },
  {
    id: 'github',
    label: `${brand.name} for GitHub`,
    desc: 'Install the GitHub app for PR reviews, issue triage, and CI agents',
    kind: 'guide',
    url: `${site}/github`,
    steps: [
      'Open the link and install the app on your account or org.',
      'Select the repositories it can access; you can change this later in GitHub settings.',
    ],
  },
];

export function getComponent(id: string): Component | undefined {
  return COMPONENTS.find((c) => c.id === id);
}

/** Install one component. npm packages are installed; guides are walked. */
export async function installComponent(c: Component): Promise<void> {
  if (c.kind === 'npm') return npmInstallGlobal(c);
  return walkGuide(c);
}

/** Install a set of components in order. */
export async function installComponents(cs: Component[]): Promise<void> {
  for (const c of cs) await installComponent(c);
}

/**
 * Let the user choose components from a checklist (core tools pre-checked).
 * Non-interactive (piped/CI) returns just the core tools so it never blocks.
 */
export async function pickComponents(): Promise<Component[]> {
  if (!process.stdout.isTTY) return COMPONENTS.filter((c) => c.core);
  const { picked } = await inquirer.prompt<{ picked: string[] }>([
    {
      type: 'checkbox',
      name: 'picked',
      message: 'What should I set up?',
      pageSize: 12,
      choices: COMPONENTS.map((c) => ({
        name: `${c.label} ${chalk.dim('— ' + c.desc)}`,
        value: c.id,
        checked: c.core ?? false,
      })),
    },
  ]);
  return picked.map((id) => getComponent(id)!).filter(Boolean);
}

function walkGuide(c: Component): void {
  console.log();
  console.log(`  ${chalk.bold(c.label)}`);
  if (c.url) console.log(`  ${chalk.cyan(c.url)}`);
  for (const s of c.steps ?? []) console.log(chalk.dim(`    ${s}`));
  if (c.url) openUrl(c.url);
}

function npmInstallGlobal(c: Component): Promise<void> {
  const spinner = ora(`Installing ${c.label}…`).start();
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', c.pkg!], { stdio: 'pipe' });
    child.stderr?.on('data', (d) => (spinner.text = String(d).trim().slice(0, 60)));
    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green(`${c.label} installed`));
        if (c.run) console.log(chalk.dim(`    run: ${c.run}`));
      } else {
        spinner.fail(chalk.red(`Failed to install ${c.pkg} (exit ${code})`));
      }
      resolve();
    });
    child.on('error', (e) => {
      spinner.fail(chalk.red(`Failed to install ${c.pkg}: ${e.message}`));
      resolve();
    });
  });
}

/**
 * `hanzo login` — the one command that does everything:
 *   1. Device login against hanzo.id (no password typed into the terminal).
 *   2. Mint (or reuse) a Hanzo API key.
 *   3. Pick a default model.
 *   4. Point the chosen coding tools (Claude Code, Codex) at Hanzo Cloud.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { spawn } from 'node:child_process';
import { requestDeviceCode, pollForToken, fetchUser, DeviceAuthError } from '../lib/iam';
import { ensureApiKey } from '../lib/apikeys';
import { setConfig } from '../lib/config';
import { endpoints } from '../lib/endpoints';
import { FEATURED_MODELS, DEFAULT_MODEL } from '../lib/models';
import { TARGETS, getTarget, codexEnvHint } from '../targets';

export interface LoginOptions {
  tool?: string;
  /** Default model; when undefined the user is prompted. */
  model?: string;
  browser: boolean;
  all?: boolean;
  /** Paste an existing hk- key instead of doing a browser device login. */
  key?: string;
}

export const loginCmd = new Command('login')
  .description('Sign in to Hanzo and configure your coding tools')
  .option('--tool <id>', 'Configure a specific tool (claude-code, codex)')
  .option('--model <id>', 'Default model to use')
  .option('--key <hk-...>', 'Use an existing Hanzo API key instead of browser login')
  .option('--no-browser', 'Do not open the browser automatically')
  .option('--all', 'Configure every installed tool without prompting')
  .action(async (opts: LoginOptions) => runLogin(opts));

/**
 * The full login + setup flow. Exported so bare `hanzo` / `npx @hanzo/helper`
 * can run it directly when you're signed out.
 */
export async function runLogin(opts: LoginOptions): Promise<void> {
  try {
    const apiKey = await acquireApiKey(opts);

    const model = opts.model ?? (await pickModel());

    const targets = await resolveTargets(opts);
    if (targets.length === 0) {
      console.log(chalk.yellow('\nNo coding tools selected. Nothing configured.'));
      console.log(chalk.dim('Your API key is saved; run `hanzo use <tool>` later.'));
      return;
    }

    const creds = { apiKey, apiBase: endpoints.api, model };
    for (const t of targets) {
      t.configure(creds);
      console.log(chalk.green(`  ✓ ${t.displayName} → Hanzo Cloud (${model})`));
    }

    printNextSteps(targets.map((t) => t.id), model);
  } catch (err) {
    fail(err);
  }
}

/**
 * Get a usable hk- key by whichever route fits: an explicit --key, a pasted key,
 * or a browser device login that mints one. The result is persisted either way.
 */
async function acquireApiKey(opts: LoginOptions): Promise<string> {
  // Non-interactive: a key was supplied on the command line.
  if (opts.key) return saveKey(opts.key.trim());

  // Interactive: offer browser login (recommended) or pasting an existing key.
  const { method } = await inquirer.prompt<{ method: 'browser' | 'paste' }>([
    {
      type: 'list',
      name: 'method',
      message: 'How do you want to connect to Hanzo?',
      choices: [
        { name: 'Sign in with a browser (recommended)', value: 'browser' },
        { name: 'Paste an existing Hanzo API key', value: 'paste' },
      ],
    },
  ]);

  if (method === 'paste') {
    const { key } = await inquirer.prompt<{ key: string }>([
      {
        type: 'password',
        name: 'key',
        message: 'Hanzo API key (hk-…):',
        mask: '*',
        validate: (v: string) => v.trim().startsWith('hk-') || 'Keys start with "hk-".',
      },
    ]);
    return saveKey(key.trim());
  }

  return browserLogin(opts);
}

/** Device-login in the browser, mint/reuse the key, persist session + key. */
async function browserLogin(opts: LoginOptions): Promise<string> {
  const dc = await requestDeviceCode();

  console.log();
  console.log(chalk.bold('  Sign in to Hanzo'));
  console.log(`  Visit       ${chalk.cyan(dc.verificationUri)}`);
  console.log(`  Enter code  ${chalk.bold.yellow(dc.userCode)}`);
  console.log();

  if (opts.browser) openBrowser(dc.verificationUriComplete);

  const spinner = ora('Waiting for you to approve in the browser…').start();
  const { accessToken } = await pollForToken(dc, (secs) => {
    spinner.text = `Waiting for approval… (${secs}s left)`;
  });
  spinner.succeed('Signed in');

  const user = await fetchUser(accessToken).catch(() => undefined);
  if (user) console.log(chalk.dim(`  ${user.name}${user.email ? ` <${user.email}>` : ''}`));

  const keySpinner = ora('Provisioning API key…').start();
  const apiKey = await ensureApiKey(accessToken);
  keySpinner.succeed('API key ready');

  await setConfig((c) => ({ ...c, accessToken, apiKey, ...(user ? { user } : {}) }));
  return apiKey;
}

/** Persist a pasted/supplied key (no OAuth token, so key-management is limited). */
async function saveKey(key: string): Promise<string> {
  if (!key.startsWith('hk-')) {
    throw new Error('That does not look like a Hanzo API key (expected an "hk-" prefix).');
  }
  await setConfig((c) => ({ ...c, apiKey: key }));
  console.log(chalk.green('  ✓ API key saved'));
  return key;
}

async function pickModel(): Promise<string> {
  const { model } = await inquirer.prompt<{ model: string }>([
    {
      type: 'list',
      name: 'model',
      message: 'Default model:',
      choices: FEATURED_MODELS.map((m) => ({ name: m.label, value: m.id })),
      default: DEFAULT_MODEL,
    },
  ]);
  return model;
}

async function resolveTargets(opts: { tool?: string; all?: boolean }) {
  if (opts.tool) {
    const t = getTarget(opts.tool);
    if (!t) throw new Error(`Unknown tool: ${opts.tool}. Try one of: ${TARGETS.map((x) => x.id).join(', ')}`);
    return [t];
  }

  const installed = TARGETS.filter((t) => t.status().installed);
  if (opts.all) return installed.length > 0 ? installed : [...TARGETS];

  const { picked } = await inquirer.prompt<{ picked: string[] }>([
    {
      type: 'checkbox',
      name: 'picked',
      message: 'Configure which coding tools?',
      choices: TARGETS.map((t) => ({
        name: t.status().installed ? `${t.displayName} ${chalk.dim('(installed)')}` : t.displayName,
        value: t.id,
        checked: t.status().installed,
      })),
    },
  ]);
  return picked.map((id) => getTarget(id)!).filter(Boolean);
}

function printNextSteps(ids: string[], model: string): void {
  console.log();
  console.log(chalk.bold('  You are all set.'));
  if (ids.includes('claude-code')) {
    console.log(`  ${chalk.cyan('claude')}   then ask anything — it now talks to Hanzo (${model}).`);
  }
  if (ids.includes('codex')) {
    console.log(`  ${chalk.cyan('codex')}    Hanzo provider configured.`);
    console.log(chalk.dim(`           Add to your shell so Codex sees the key:`));
    console.log(chalk.dim(`           ${codexEnvHint()}`));
  }
  console.log();
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
  } catch {
    /* user can open it manually */
  }
}

function fail(err: unknown): never {
  const msg = err instanceof DeviceAuthError || err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`\n✗ ${msg}`));
  process.exit(1);
}

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
import { requestDeviceCode, pollForToken, fetchUser, DeviceAuthError } from '../lib/iam';
import { ensureApiKey } from '../lib/apikeys';
import { setConfig } from '../lib/config';
import { endpoints } from '../lib/endpoints';
import {
  DEFAULT_MODEL,
  resolveModel,
  fetchCatalog,
  aliasesFrom,
  type CloudModel,
} from '../lib/models';
import { installShellEnv, detectShell } from '../lib/shell-env';
import { openUrl } from '../lib/open';
import { installComponents, pickComponents } from '../lib/ecosystem';
import { TARGETS, getTarget, codexEnvHint } from '../targets';

export interface LoginOptions {
  tool?: string;
  /** Default model; when undefined the user is prompted. */
  model?: string;
  browser: boolean;
  all?: boolean;
  /** Paste an existing hk- key instead of doing a browser device login. */
  key?: string;
  /** Where to write the Hanzo provider: 'shell' (env vars) or 'tools' (per-tool config). */
  mode?: 'shell' | 'tools';
}

export const loginCmd = new Command('login')
  .description('Sign in to Hanzo and configure your coding tools')
  .option('--tool <id>', 'Configure a specific tool (claude-code, codex)')
  .option('--model <id|tier>', 'Model id or effort (auto, fast, high, max, code, agent)')
  .option('--key <hk-...>', 'Use an existing Hanzo API key instead of browser login')
  .option('--mode <mode>', 'Install target: shell (env vars) or tools (per-tool config)')
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

    // One live catalog read drives both the model picker and the per-tool model
    // list — the cloud is the source of truth, so nothing here is hardcoded.
    const catalog = await fetchCatalog(apiKey).catch(() => [] as CloudModel[]);
    const model = opts.model ? resolveModel(opts.model) : await pickModel(catalog);
    const models = catalog.map((m) => m.id);
    const creds = { apiKey, apiBase: endpoints.api, model, ...(models.length ? { models } : {}) };

    const mode = await resolveMode(opts);
    if (mode === 'shell') {
      const target = installShellEnv(creds);
      console.log(chalk.green(`  ✓ Wrote Hanzo env vars to ${target.rcFile} (${model})`));
      console.log(chalk.dim(`    Open a new terminal, or: source ${target.rcFile}`));
      console.log(chalk.dim(`    Every Anthropic-compatible tool now uses Hanzo (${endpoints.api}).`));
      await maybeOfferEcosystem(opts);
      return;
    }

    // Per-tool settings mode.
    const targets = await resolveTargets(opts);
    if (targets.length === 0) {
      console.log(chalk.yellow('\nNo coding tools selected. Nothing configured.'));
      console.log(chalk.dim('Your API key is saved; run `hanzo use <tool>` later.'));
      return;
    }

    for (const t of targets) {
      t.configure(creds);
      console.log(chalk.green(`  ✓ ${t.displayName} → Hanzo Cloud (${model})`));
    }

    printNextSteps(targets.map((t) => t.id), model);
    await maybeOfferEcosystem(opts);
  } catch (err) {
    fail(err);
  }
}

/**
 * Decide whether to install into the shell environment (affects every
 * Anthropic-compatible tool) or into individual tool config files (additive,
 * scoped per tool). Honors --mode; otherwise asks.
 */
async function resolveMode(opts: LoginOptions): Promise<'shell' | 'tools'> {
  if (opts.mode) return opts.mode;
  if (opts.tool || opts.all) return 'tools'; // explicit tool selection implies per-tool

  const sh = detectShell();
  const { mode } = await inquirer.prompt<{ mode: 'shell' | 'tools' }>([
    {
      type: 'list',
      name: 'mode',
      message: 'How should Hanzo be installed?',
      choices: [
        {
          name: `Into specific coding tools (Claude Code, Codex) — additive, recommended`,
          value: 'tools',
        },
        {
          name: `Into your shell env (${sh.shell}) — Hanzo becomes the default for every Anthropic tool`,
          value: 'shell',
        },
      ],
    },
  ]);
  return mode;
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

  if (opts.browser) openUrl(dc.verificationUriComplete);

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

/**
 * Pick a default model from the live catalog. Smart tiers (the cloud's own
 * routing aliases) lead — they keep working as the catalog changes — followed
 * by the full concrete list. Premium (credit-gated) models are tagged.
 */
async function pickModel(catalog: CloudModel[]): Promise<string> {
  if (catalog.length === 0) return DEFAULT_MODEL;
  const aliases = aliasesFrom(catalog);
  const aliasIds = new Set(aliases.map((a) => a.id));
  const tag = (m: CloudModel) => (m.premium ? chalk.yellow(' (needs credits)') : '');

  const choices = [
    new inquirer.Separator(chalk.dim('  ── Smart tiers — the cloud picks the model ──')),
    ...aliases.map((m) => ({ name: `${m.id}${tag(m)}`, value: m.id })),
    new inquirer.Separator(chalk.dim('  ── All models ──')),
    ...catalog
      .filter((m) => !aliasIds.has(m.id))
      .map((m) => ({ name: `${m.id}${tag(m)} ${chalk.dim(m.ownedBy)}`, value: m.id })),
  ];

  const { model } = await inquirer.prompt<{ model: string }>([
    {
      type: 'list',
      name: 'model',
      message: 'Default model:',
      choices,
      default: DEFAULT_MODEL,
      pageSize: 16,
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

/**
 * Out-of-box wizard tail: offer to set up the rest of the ecosystem (dev, mcp,
 * apps). Interactive only; explicit non-interactive flags skip it silently.
 */
async function maybeOfferEcosystem(opts: LoginOptions): Promise<void> {
  if (!process.stdout.isTTY || opts.key || opts.tool || opts.all) return;
  const { go } = await inquirer.prompt<{ go: boolean }>([
    {
      type: 'confirm',
      name: 'go',
      message: 'Set up more of the Hanzo ecosystem now (dev, mcp, apps)?',
      default: false,
    },
  ]);
  if (!go) {
    console.log(chalk.dim('  Later: `hanzo install`'));
    return;
  }
  await installComponents(await pickComponents());
}

function fail(err: unknown): never {
  const msg = err instanceof DeviceAuthError || err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`\n✗ ${msg}`));
  process.exit(1);
}

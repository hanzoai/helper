#!/usr/bin/env node
/**
 * @hanzo/helper — sign in to Hanzo and point your coding tools at Hanzo Cloud.
 */

import { Command } from 'commander';
import { loginCmd, runLogin } from './commands/login';
import { useCmd, unuseCmd } from './commands/use';
import { authCmd } from './commands/auth';
import { installCmd } from './commands/install';
import { statusCmd, runStatus } from './commands/status';
import { modelsCmd } from './commands/models';
import { kmsCmd } from './commands/kms';
import { doctorCmd } from './commands/doctor';
import { getConfig } from './lib/config';
import { brand } from './lib/brand';
import { version } from './lib/version';

const program = new Command();

// `hanzo` is the Hanzo CLI (a native binary, curl -fsSL https://hanzo.sh | sh).
// This program is `hanzo-helper`. Two programs under one name is how `hanzo
// login` came to mean different things depending on install order.
program
  .name(`${brand.bin}-helper`)
  .description(`Sign in to ${brand.name} and use its AI models in Claude Code, Codex, and more`)
  .version(version);

program.addCommand(loginCmd);
program.addCommand(useCmd);
program.addCommand(unuseCmd);
program.addCommand(authCmd);
program.addCommand(installCmd);
program.addCommand(statusCmd);
program.addCommand(modelsCmd);
program.addCommand(kmsCmd);
program.addCommand(doctorCmd);

// Bare `hanzo` (or `npx @hanzo/helper`): if you're not signed in, run the login
// + setup flow — the one thing most people want. If you already are, show where
// things stand instead of pointlessly re-authenticating.
program.action(async () => {
  const { apiKey } = await getConfig();
  if (apiKey) await runStatus();
  else await runLogin({ model: undefined, browser: true });
});

await program.parseAsync(process.argv);

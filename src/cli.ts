#!/usr/bin/env node
/**
 * @hanzo/helper — sign in to Hanzo and point your coding tools at Hanzo Cloud.
 */

import { Command } from 'commander';
import { loginCmd } from './commands/login';
import { useCmd, unuseCmd } from './commands/use';
import { authCmd } from './commands/auth';
import { installCmd } from './commands/install';
import { statusCmd } from './commands/status';
import { modelsCmd } from './commands/models';
import { doctorCmd } from './commands/doctor';
import { version } from './lib/version';

const program = new Command();

program
  .name('hanzo')
  .description('Sign in to Hanzo and use its AI models in Claude Code, Codex, and more')
  .version(version);

program.addCommand(loginCmd);
program.addCommand(useCmd);
program.addCommand(unuseCmd);
program.addCommand(authCmd);
program.addCommand(installCmd);
program.addCommand(statusCmd);
program.addCommand(modelsCmd);
program.addCommand(doctorCmd);

program.action(() => program.outputHelp());

await program.parseAsync(process.argv);

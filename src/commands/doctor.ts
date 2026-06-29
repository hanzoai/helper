/**
 * `hanzo doctor` — quick health check: reachability, session, tool config.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config';
import { endpoints } from '../lib/endpoints';
import { TARGETS } from '../targets';

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export const doctorCmd = new Command('doctor')
  .description('Diagnose Hanzo connectivity and tool configuration')
  .action(async () => {
    const checks: Check[] = [];

    checks.push(await reachable('IAM', `${endpoints.iam}/api/health`));
    checks.push(await reachable('Cloud API', `${endpoints.api}/v1/health`));

    const { apiKey, user } = await getConfig();
    checks.push({
      name: 'Session',
      pass: Boolean(apiKey),
      detail: apiKey ? `signed in${user ? ` as ${user.name}` : ''}` : 'run `hanzo login`',
    });

    const configured = TARGETS.filter((t) => t.status().configured).map((t) => t.displayName);
    checks.push({
      name: 'Coding tools',
      pass: configured.length > 0,
      detail: configured.length > 0 ? `using Hanzo: ${configured.join(', ')}` : 'none configured',
    });

    console.log();
    for (const c of checks) {
      const icon = c.pass ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${c.name.padEnd(14)} ${chalk.dim(c.detail)}`);
    }
    console.log();

    if (!checks.every((c) => c.pass)) process.exit(1);
  });

async function reachable(name: string, url: string): Promise<Check> {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    // Any HTTP response means the host is up; we don't require 200.
    return { name, pass: res.status < 500, detail: `${new URL(url).host} (${res.status})` };
  } catch (err) {
    return { name, pass: false, detail: `unreachable: ${err instanceof Error ? err.message : err}` };
  }
}

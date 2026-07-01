/**
 * Device sign-in — the one IAM login primitive, shared by every entry point
 * (`hanzo login`, `hanzo auth login`, `kms login`). It runs the RFC 8628 device
 * flow against hanzo.id, resolves the user, and persists the access token +
 * identity to the shared ~/.hanzo/config.json. One token store, one flow.
 *
 * It deliberately does NOT mint an API key or configure tools — that is
 * `hanzo login`'s job on top of this. A caller that only needs an IAM session
 * (e.g. `kms` reading secrets) uses this alone.
 */

import chalk from 'chalk';
import ora from 'ora';
import { requestDeviceCode, pollForToken, fetchUser } from './iam';
import { setConfig, type UserInfo } from './config';
import { openUrl } from './open';

export interface SignInResult {
  accessToken: string;
  user?: UserInfo;
}

/**
 * Run the browser device-login flow and persist the session. `openBrowser`
 * (default true) auto-opens the approval page; set false for `--no-browser`.
 */
export async function deviceSignIn(openBrowser = true): Promise<SignInResult> {
  const dc = await requestDeviceCode();

  console.log();
  console.log(chalk.bold('  Sign in to Hanzo'));
  console.log(`  Visit       ${chalk.cyan(dc.verificationUri)}`);
  console.log(`  Enter code  ${chalk.bold.yellow(dc.userCode)}`);
  console.log();

  if (openBrowser) openUrl(dc.verificationUriComplete);

  const spinner = ora('Waiting for you to approve in the browser…').start();
  const { accessToken } = await pollForToken(dc, (secs) => {
    spinner.text = `Waiting for approval… (${secs}s left)`;
  });
  spinner.succeed('Signed in');

  const user = await fetchUser(accessToken).catch(() => undefined);
  if (user) console.log(chalk.dim(`  ${user.name}${user.email ? ` <${user.email}>` : ''}`));

  await setConfig((c) => ({ ...c, accessToken, ...(user ? { user } : {}) }));
  return { accessToken, ...(user ? { user } : {}) };
}

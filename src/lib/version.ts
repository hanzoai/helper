/**
 * The CLI's version. Injected at build time from package.json (tsup `define`
 * replaces __HANZO_VERSION__), so it can never drift from the published version.
 * The fallback keeps `tsx`/dev runs working when the define isn't set.
 */
declare const __HANZO_VERSION__: string | undefined;

export const version =
  typeof __HANZO_VERSION__ === 'string' ? __HANZO_VERSION__ : '0.0.0-dev';

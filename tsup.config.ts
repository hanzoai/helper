import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/kms-cli.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  dts: false,
  sourcemap: true,
  splitting: false,
  bundle: true,
  noExternal: [],
  // Single source of truth for the CLI version: package.json, inlined at build.
  define: { __HANZO_VERSION__: JSON.stringify(version) },
  esbuildOptions(options) {
    options.banner = {
      js: '// @hanzo/helper - Hanzo CLI for API access, cloud services, MCP, and plugins',
    };
  },
});

import { defineConfig } from 'tsup';

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
  esbuildOptions(options) {
    options.banner = {
      js: '// @hanzo/helper - Hanzo CLI for API access, cloud services, MCP, and plugins',
    };
  },
});

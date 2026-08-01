# @luxfi/helper

> Sign in to Lux and point your coding tools at the Lux AI cloud.

```bash
npx @luxfi/helper login
```

One command does browser device login, mints your Lux API key, and writes the
config your coding tools read.

The Lux-branded build of [`@hanzo/helper`](https://www.npmjs.com/package/@hanzo/helper) —
identical engine, Lux defaults (`lux.id`, `api.lux.network`, `lux-app`).

## The command is `lux-helper`

`lux` is the Lux CLI, a different program. Installing this package gives you
`lux-helper`, so the two never shadow each other on PATH.

```bash
npm i -g @luxfi/helper
lux-helper login
lux-helper status
lux-helper models
```

See the [upstream README](https://github.com/hanzoai/helper) for the full command reference.
License: Apache-2.0.

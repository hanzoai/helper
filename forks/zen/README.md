# @zenlm/helper

> Sign in to Zen and point your coding tools at the Zen AI cloud.

```bash
npx @zenlm/helper login
```

One command does browser device login, mints your Zen API key, and writes the
config your coding tools read.

The Zen-branded build of [`@hanzo/helper`](https://www.npmjs.com/package/@hanzo/helper) —
identical engine, Zen defaults (`id.zenlm.org`, `api.zenlm.org`, `zen-app`).

## The command is `zen-helper`

`zen` is the Zen CLI, a different program. Installing this package gives you
`zen-helper`, so the two never shadow each other on PATH.

```bash
npm i -g @zenlm/helper
zen-helper login
zen-helper status
zen-helper models
```

See the [upstream README](https://github.com/hanzoai/helper) for the full command reference.
License: Apache-2.0.

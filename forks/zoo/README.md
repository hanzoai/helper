# @zooai/helper

> Sign in to Zoo and point your coding tools at the Zoo AI cloud.

```bash
npx @zooai/helper login
```

One command does browser device login, mints your Zoo API key, and writes the
config your coding tools read.

The Zoo-branded build of [`@hanzo/helper`](https://www.npmjs.com/package/@hanzo/helper) —
identical engine, Zoo defaults (`zoolabs.id`, `api.zoo.ngo`, `zoo-app`).

## The command is `zoo-helper`

`zoo` is the Zoo CLI, a different program. Installing this package gives you
`zoo-helper`, so the two never shadow each other on PATH.

```bash
npm i -g @zooai/helper
zoo-helper login
zoo-helper status
zoo-helper models
```

See the [upstream README](https://github.com/hanzoai/helper) for the full command reference.
License: Apache-2.0.

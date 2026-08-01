# @hanzo/helper

> Sign in to Hanzo and point your coding tools at Hanzo Cloud.

One command does browser device login, mints an `hk-` API key for you, and writes
the config your coding tools read. `api.hanzo.ai` answers on both the
`/v1/chat/completions` and `/v1/messages` shapes, so a tool built for either
works against the whole Hanzo catalog — the Zen family (`zen5`, `zen5-coder`,
`enso`, …) and every model your key can route to.

## Quick start

```bash
npx @hanzo/helper login
```

That will:

1. Open `hanzo.id` and show you a device code to approve.
2. Mint (or reuse) your `hk-` Cloud API key.
3. Let you pick a default model.
4. Configure the coding tools you choose.

Then run your tool — it is already talking to Hanzo.

## The command is `hanzo-helper`, not `hanzo`

`hanzo` is the [Hanzo CLI](https://hanzo.sh), a native binary with a command
group per Hanzo Cloud product. This package installs `hanzo-helper` so the two
never shadow each other on PATH. (In the CLI, signing in is `hanzo auth login`; a
bare `hanzo login` is read there as an AI task.)

```bash
npm i -g @hanzo/helper
hanzo-helper login
```

## Commands

| Command | What it does |
| --- | --- |
| `hanzo-helper login` | Device login, mint API key, configure tools |
| `hanzo-helper use [tool]` | Point a tool at Hanzo using your saved key |
| `hanzo-helper unuse [tool]` | Detach a tool from Hanzo (keep its other settings) |
| `hanzo-helper status` | Session + every tool's configuration state |
| `hanzo-helper models` | List models available to your key |
| `hanzo-helper auth status` | Who you're signed in as |
| `hanzo-helper auth key [--reveal]` | Show your current API key |
| `hanzo-helper auth rotate` | Mint a fresh API key (the old one stops working) |
| `hanzo-helper auth revoke` | Revoke your API key |
| `hanzo-helper auth logout` | Clear local credentials |
| `hanzo-helper kms pull` | Pull env secrets from KMS for local dev (also `kms`) |
| `hanzo-helper install [parts…]` | Set up the ecosystem (dev, mcp, node, apps, …) |
| `hanzo-helper doctor` | Diagnose connectivity and tool configuration |

Bare `hanzo-helper` runs login if you are signed out, and status if you are not.

## Choosing a model

The catalog is read live from `api.hanzo.ai/v1/models` — nothing is hardcoded, so
new models appear without a release here.

```bash
hanzo-helper models                       # the live catalog for your key
hanzo-helper use claude-code --model zen5-coder
```

`--model` takes any id the catalog returns.

### Secrets for local dev (`kms`)

One login, one mechanism. Your login mints an IAM OIDC token; `kms` exchanges it
for a short-lived KMS token and reads an environment's secrets. KMS owns secrets,
envs and authz (`/v1/kms/*`); IAM only issues the token (`/v1/iam/*`) — they
compose through the token, nothing braided.

```bash
kms pull --env devnet            # write .env for local dev (also: hanzo-helper kms pull)
kms list --env devnet            # secret names only, no values
kms pull --env testnet --out -   # print to stdout
```

Environments: `devnet` (default), `testnet`, `mainnet`, `production`. CI uses the
*same* `/v1/kms/*` exchange with a GitHub OIDC token — see
`.github/actions/kms-secrets` and the reusable `.github/workflows/npm-release.yml`.

### Supported coding tools

- **Claude Code** — adds a `providers.hanzo` block to `~/.claude/settings.json`
  (additive; switch per-session with `/model hanzo/<id>`). Choose shell-env mode
  at login to make Hanzo the default for every Anthropic-compatible tool instead.
- **Codex** — adds a `[model_providers.hanzo]` provider to
  `~/.codex/config.toml` (key in `~/.hanzo/env` as `HANZO_API_KEY`).

### The whole ecosystem

```bash
hanzo-helper install              # interactive checklist (core tools pre-checked)
hanzo-helper install dev mcp      # CLI agent + MCP server (npm)
hanzo-helper install list         # everything available
```

| Part | Kind | |
| --- | --- | --- |
| `dev` | npm | `@hanzo/dev` — CLI coding agent |
| `mcp` | npm | `@hanzo/mcp` — MCP server (tools, browser, cloud) |
| `node` | guide | local inference node (bundles the engine) |
| `desktop` | guide | desktop app + the Enso browser |
| `extension` | guide | browser extension (Chrome / Firefox / Safari) |
| `ide` | guide | VS Code & JetBrains extensions |
| `slack` | guide | the Slack app |
| `github` | guide | the GitHub app |

## How it works

```
 hanzo-helper login
     │
     ├── device login ─────────────▶ hanzo.id  (RFC 8628; proxies to iam.hanzo.ai)
     │     POST /oauth/device           → user_code + verification_uri
     │     POST /oauth/token  (poll)     → access_token
     │
     ├── mint API key ─────────────▶ iam  POST /v1/iam/mint-user-keys  → hk-…
     │     (self-authorized by your login token)
     │
     └── configure tools ──────────▶ ~/.claude/settings.json
                                     ~/.codex/config.toml
                                            │
 your coding tool ──────────────────▶ api.hanzo.ai
     /v1/chat/completions                  (one key, every model)
     /v1/messages
```

### Self-hosted / white-label

Point the CLI at a different deployment with environment variables:

| Var | Default | Purpose |
| --- | --- | --- |
| `HANZO_IAM_URL` | `https://hanzo.id` | Identity / device login |
| `HANZO_API_URL` | `https://api.hanzo.ai` | Cloud API (keys, inference) |
| `HANZO_CLIENT_ID` | `hanzo-app` | OAuth client id (e.g. `lux-app`) |

The same build ships as `@luxfi/helper` (`lux-helper`), `@zooai/helper`
(`zoo-helper`) and `@zenlm/helper` (`zen-helper`) with that brand's defaults.

## Configuration

`~/.hanzo/config.json` (mode `0600`) holds your login token, API key, and
identity. `~/.hanzo/env` holds the raw key for tools that read it from the
environment.

## Build

```bash
pnpm install
pnpm build      # tsup → dist/
pnpm typecheck
```

## License

Apache-2.0

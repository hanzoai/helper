# @hanzo/helper

Points a coding tool at [Hanzo Cloud](https://hanzo.ai) in one command: browser device
login, an API key minted for you, and the tool's config written for you.

`api.hanzo.ai` answers on both the OpenAI shape (`/v1/chat/completions`) and the Anthropic
shape (`/v1/messages`), so a tool built for either one works once it is pointed here.

## Quick start

```bash
npx @hanzo/helper login
```

That opens `hanzo.id` with a device code to approve, mints (or reuses) your `hk-` API key,
lets you pick a default model, and configures the tools you choose.

Then run your tool — it is already talking to Hanzo:

```bash
claude          # Claude Code
codex           # Codex
```

Installing it globally puts it on your path as `hanzo-helper`:

```bash
npm install -g @hanzo/helper
hanzo-helper status
```

It is deliberately **not** called `hanzo` — that name belongs to the
[Hanzo CLI](https://github.com/hanzoai/cli), a different program.

## Commands

| Command | What it does |
| --- | --- |
| `hanzo-helper login` | Device login, mint the API key, configure tools |
| `hanzo-helper use [tool]` | Point a tool at Hanzo with your saved key |
| `hanzo-helper unuse [tool]` | Detach a tool, leaving its other settings alone |
| `hanzo-helper status` | Session, plus every tool's configuration state |
| `hanzo-helper models [name]` | Models available to your key (`--all`, `--tiers`) |
| `hanzo-helper auth status` | Who you are signed in as |
| `hanzo-helper auth key [--reveal]` | Show the current key |
| `hanzo-helper auth rotate` | Mint a fresh key; the old one stops working |
| `hanzo-helper auth revoke` | Revoke the key |
| `hanzo-helper auth logout` | Forget the local session |
| `hanzo-helper kms pull` | Pull env secrets from KMS for local dev |
| `hanzo-helper install [parts…]` | Set up the rest of the tooling |
| `hanzo-helper doctor` | Diagnose connectivity and tool configuration |

## Choosing a model

The catalog is read live from `api.hanzo.ai/v1/models` — nothing is hardcoded here. Pass a
concrete id, or an effort word and let the cloud pick:

```bash
hanzo-helper models             # the live catalog for your key
hanzo-helper models --tiers     # the effort words and what they route to
hanzo-helper use claude-code --model high
```

`enso` and the `zen5` family are ours; any model you have a provider key for is routed too.

## Secrets for local dev

One login, one mechanism. `hanzo-helper login` mints an IAM OIDC token; `kms` exchanges it
for a short-lived KMS token and reads an environment's secrets. KMS owns secrets,
environments and authorization (`/v1/kms/*`); IAM only issues the token (`/v1/iam/*`).

```bash
hanzo-helper kms pull --env devnet      # write .env for local dev
hanzo-helper kms list --env devnet      # names only, no values
hanzo-helper kms pull --env testnet --out -
```

Environments are `devnet` (default), `testnet`, `mainnet` and `production`. CI uses the
same `/v1/kms/*` exchange with a GitHub OIDC token — see `.github/actions/kms-secrets` and
the reusable `.github/workflows/npm-release.yml`.

## Which tools it configures

- **Claude Code** — adds a `providers.hanzo` block to `~/.claude/settings.json`. Additive,
  so your other providers stay; switch per session with `/model hanzo/<id>`. Pick shell-env
  mode at login instead to make Hanzo the default for every Anthropic-shaped tool.
- **Codex** — adds a `[model_providers.hanzo]` provider to `~/.codex/config.toml`, with the
  key in `~/.hanzo/env` as `HANZO_API_KEY`.

`hanzo-helper install` sets up the rest of the ecosystem — `dev`, the MCP server, the
local node, the desktop app, the browser extension, the IDE extensions, the Slack and
GitHub apps. `hanzo-helper install list` prints what is available.

## How login works

```
 hanzo-helper login
     │
     ├── device login ─────────────▶ hanzo.id  (RFC 8628; proxies to iam.hanzo.ai)
     │     POST /oauth/device            → user_code + verification_uri
     │     POST /oauth/token   (poll)    → access_token
     │
     ├── mint API key ─────────────▶ iam  POST /v1/iam/mint-user-keys  → hk-…
     │     (self-authorized by your login token)
     │
     └── configure tools ──────────▶ ~/.claude/settings.json
                                     ~/.codex/config.toml
                                            │
 your coding tool ──────────────────▶ api.hanzo.ai
```

## Self-hosted and white-label

| Variable | Default | Purpose |
| --- | --- | --- |
| `HANZO_IAM_URL` | `https://hanzo.id` | Identity, device login |
| `HANZO_API_URL` | `https://api.hanzo.ai` | Cloud API — keys, inference |
| `HANZO_CLIENT_ID` | `hanzo-app` | OAuth client id (e.g. `lux-app`) |

`~/.hanzo/config.json` (mode `0600`) holds your login token, API key and identity.
`~/.hanzo/env` holds the raw key for tools that read it from the environment.

## Build

```bash
pnpm install
pnpm build      # tsup → dist/
pnpm typecheck
```

## License

Apache-2.0

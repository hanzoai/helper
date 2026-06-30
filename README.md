# @hanzo/helper

> Sign in to Hanzo and use its AI models in Claude Code, Codex, and other coding tools.

One command points your coding tool at [Hanzo Cloud](https://hanzo.ai): browser
device login, an API key minted for you, and the tool configured to talk to
`api.hanzo.ai` — which speaks both the OpenAI (`/v1/chat/completions`) and
Anthropic (`/v1/messages`) protocols, so every model (Claude, GLM, GPT,
DeepSeek, Kimi, …) works in tools built for either.

## Quick start

```bash
npx @hanzo/helper login
```

That will:

1. Open `hanzo.id` and show you a device code to approve.
2. Mint (or reuse) your `hk-` Cloud API key.
3. Let you pick a default model.
4. Configure the coding tools you choose.

Then just run your tool — it's already talking to Hanzo:

```bash
claude          # Claude Code → Hanzo Cloud
codex           # Codex → Hanzo Cloud
```

## Commands

| Command | What it does |
| --- | --- |
| `hanzo login` | Device login, mint API key, configure tools |
| `hanzo use [tool]` | Point a tool at Hanzo using your saved key |
| `hanzo unuse [tool]` | Detach a tool from Hanzo (keep its other settings) |
| `hanzo status` | Session + every tool's configuration state |
| `hanzo models` | List models available to your key |
| `hanzo auth status` | Who you're signed in as |
| `hanzo auth key [--reveal]` | Show your current API key |
| `hanzo auth rotate` | Mint a fresh API key (old one stops working) |
| `hanzo auth revoke` | Revoke your API key |
| `hanzo auth logout` | Clear local credentials |
| `hanzo models --tiers` | Show the smart tiers (effort words → cloud aliases) |
| `hanzo kms pull` | Pull env secrets from KMS for local dev (also `kms`) |
| `hanzo install [parts…]` | Set up the ecosystem (dev, mcp, node, apps, …) |
| `hanzo doctor` | Diagnose connectivity and tool configuration |

### Secrets for local dev (`kms`)

One login, one mechanism. Your `hanzo login` mints an IAM OIDC token; `kms`
exchanges it for a short-lived KMS token and reads an environment's secrets.
KMS owns secrets, envs and authz (`/v1/kms/*`); IAM only issues the token
(`/v1/iam/*`) — they compose through the token, nothing braided.

```bash
kms pull --env devnet            # write .env for local dev (also: hanzo kms pull)
kms list --env devnet            # secret names only, no values
kms pull --env testnet --out -   # print to stdout
```

Environments: `devnet` (default), `testnet`, `mainnet`, `production`. CI uses
the *same* `/v1/kms/*` exchange with a GitHub OIDC token — see
`.github/actions/kms-secrets` and the reusable `.github/workflows/npm-release.yml`.

### Smart tiers

The catalog is read live from `api.hanzo.ai/v1/models` — nothing is hardcoded.
Beyond concrete ids (`glm-5.2`, `deepseek-v4-pro`, …) you can ask for an
**effort word** and let the cloud pick the model:

| Word | Routes to | |
| --- | --- | --- |
| `auto` | `zen-auto` | the cloud chooses (recommended default) |
| `fast` | `zen-normal` | quick, everyday |
| `high` | `zen-pro` | stronger reasoning & coding |
| `max` | `zen-max` | top tier (needs credits) |
| `code` | `zen-code` | coding-specialised |
| `agent`| `zen-agent` | agentic |

```bash
hanzo use claude-code --model high      # or auto / fast / max / glm-5.2 …
hanzo models                            # full live catalog for your key
```

### Supported coding tools

- **Claude Code** — adds a `providers.hanzo` block to `~/.claude/settings.json`
  (additive; switch per-session with `/model hanzo/<id>`). Choose shell-env mode
  at login to make Hanzo the default for every Anthropic-compatible tool instead.
- **Codex** — adds a `[model_providers.hanzo]` provider to
  `~/.codex/config.toml` (key in `~/.hanzo/env` as `HANZO_API_KEY`).

### The whole ecosystem

```bash
hanzo install              # interactive checklist (core tools pre-checked)
hanzo install dev mcp      # CLI agent + MCP server (npm)
hanzo install list         # everything available
```

| Part | Kind | |
| --- | --- | --- |
| `dev` | npm | `@hanzo/dev` — CLI coding agent (`code`) |
| `mcp` | npm | `@hanzo/mcp` — MCP server (tools, browser, cloud) |
| `node` | guide | local inference node (bundles the engine) |
| `desktop` | guide | desktop app + the Enso browser |
| `extension` | guide | browser extension (Chrome / Firefox / Safari) |
| `ide` | guide | VS Code & JetBrains extensions |
| `slack` | guide | the Slack app |
| `github` | guide | the GitHub app |

## How it works

```
 hanzo login
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
     OpenAI  /v1/chat/completions          (one key, every model)
     Anthropic /v1/messages
```

### Self-hosted / white-label

Point the CLI at a different deployment with environment variables:

| Var | Default | Purpose |
| --- | --- | --- |
| `HANZO_IAM_URL` | `https://hanzo.id` | Identity / device login |
| `HANZO_API_URL` | `https://api.hanzo.ai` | Cloud API (keys, inference) |
| `HANZO_CLIENT_ID` | `hanzo-app` | OAuth client id (e.g. `lux-app`) |

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

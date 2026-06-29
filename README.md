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
| `hanzo install [pkgs…]` | Install Hanzo tooling (`dev`, `mcp`, `extension`) |
| `hanzo doctor` | Diagnose connectivity and tool configuration |

### Supported coding tools

- **Claude Code** — sets `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` in
  `~/.claude/settings.json`.
- **Codex** — adds a `[model_providers.hanzo]` provider to
  `~/.codex/config.toml` (key in `~/.hanzo/env` as `HANZO_API_KEY`).

Configure one explicitly:

```bash
hanzo login --tool codex --model glm-5.2
hanzo use claude-code --model claude-opus-4-8
```

### Hanzo's own tools

```bash
hanzo install dev          # @hanzo/dev — CLI coding agent
hanzo install mcp          # @hanzo/mcp — tools, browser, cloud
hanzo install extension    # @hanzo/extension — browser extension
hanzo install              # dev + mcp
```

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

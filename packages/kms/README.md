# @hanzo/kms

> Standalone `kms` CLI — sign in with IAM and pull environment secrets for local dev.

Same engine and token store as [`@hanzo/helper`](https://www.npmjs.com/package/@hanzo/helper)
(so `kms` and `hanzo kms` are interchangeable), packaged as its own `kms` command.

```bash
npm i -g @hanzo/kms        # or: npx @hanzo/kms login

kms login                  # IAM device login (shared with `hanzo login`)
kms pull --env devnet      # write .env for local dev
kms list --env devnet      # secret names only
```

Environments: `devnet` (default), `testnet`, `mainnet`, `production`. Your org
comes from your login (`--org` to override). Secrets are read from KMS over the
canonical `/v1/kms/orgs/{org}/secrets` API; KMS gates access per env.

## License

Apache-2.0

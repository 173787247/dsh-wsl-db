# dsh-wsl-db

> **Languages:** [中文（首页）](./README.md) · **English** (this file)

Read-only psql + redis-cli probes.

| | |
|---|---|
| Version | **0.1.0** |
| Kit | Optional companion to [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit); not in `install.sh` |

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-db
```

Batch link (optional): `bash dsh-wsl-kit/scripts/link-linux-plugins.sh`

## Tools

| Tool | Role |
|------|------|
| `db_status` | CLIs + connection aliases |
| `db_psql` | read-only SQL |
| `db_redis` | read-only redis cmds |

## Config

`connections / allowAnyUrl / redisHosts / timeoutMs`

Named URIs in `config.connections`; `allowAnyUrl` off by default. `redisHosts` allowlist.

## License

MIT

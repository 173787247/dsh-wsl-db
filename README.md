# dsh-wsl-db

> **语言：** **中文**（本页） · [English](./README.en.md)

psql / redis-cli 只读探针。

| | |
|---|---|
| 版本 | **0.1.0** |
| 套件 | [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit) **可选**，不在 `install.sh` |

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-db
# 或本机 path：
# dsh plugin --profile web add /mnt/c/Users/YOU/Desktop/AIFullStackDevelopment/dsh-wsl-db
```

kit 批量链接（可选）：`bash dsh-wsl-kit/scripts/link-linux-plugins.sh`

## 工具

| 工具 | 作用 |
|------|------|
| `db_status` | CLI 与连接别名 |
| `db_psql` | SELECT/WITH/SHOW/EXPLAIN |
| `db_redis` | PING/GET/INFO/SCAN… |

## 配置要点

`connections / allowAnyUrl / redisHosts / timeoutMs`

用 `config.connections` 命名 URI；默认禁止任意 URL。`redisHosts` 白名单。

## 兼容性

| 字段 | 值 |
|------|----|
| **插件** | `dsh-wsl-db` **0.1.0** |
| **最低 dsh** | ≥ **0.1.2**（Web UI 一次性 `?token=`，Windows 中继 `:3081`） |
| **最新验证** | 以 [dsh-wsl-kit 兼容性](https://github.com/173787247/dsh-wsl-kit#compatibility-2026-09) 为准（当前 **`0.1.7-alpha.2`**）— 套件唯一真源 |
| **套件档位** | 可选（默认不在 `install.sh` / `KIT_SET=daily`） |

## License

MIT

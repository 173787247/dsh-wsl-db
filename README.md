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

## License

MIT

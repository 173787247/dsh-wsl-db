import { dbStatus, psqlQuery, redisCmd } from "./lib/db.js";

export const name = "dsh-wsl-db";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  if (config.enabled === false) {
    console.log("[dsh-wsl-db] disabled");
    return;
  }
  const timeoutMs = positive(config.timeoutMs, 30_000);
  // named connections: { local: "postgresql://...", ... } — only these URLs allowed unless empty+allowAnyUrl
  const connections =
    config.connections && typeof config.connections === "object" && !Array.isArray(config.connections)
      ? Object.fromEntries(Object.entries(config.connections).map(([k, v]) => [String(k), String(v)]))
      : {};
  const allowAnyUrl = config.allowAnyUrl === true;
  const redisHosts = Array.isArray(config.redisHosts) ? config.redisHosts.map(String) : ["127.0.0.1", "localhost"];
  console.log(`[dsh-wsl-db] connections=${Object.keys(connections).length} allowAnyUrl=${allowAnyUrl}`);

  ctx.systemPrompt.section({
    name: "tool:db",
    order: 137,
    text: "dsh-wsl-db is read-only: psql SELECT/WITH/SHOW/EXPLAIN and redis-cli GET/INFO/SCAN-style commands. Prefer named connections in config. Never dump passwords into chat.",
  });

  function resolveConn(nameOrUrl) {
    const s = String(nameOrUrl || "").trim();
    if (!s) {
      if (connections.default) return connections.default;
      throw new Error("conn required (named connection or URL)");
    }
    if (connections[s]) return connections[s];
    if (/^postgres(ql)?:\/\//i.test(s)) {
      if (!allowAnyUrl && !Object.values(connections).includes(s)) {
        throw new Error("URL not in config.connections (set allowAnyUrl=true to override)");
      }
      return s;
    }
    throw new Error(`unknown connection alias: ${s}`);
  }

  function guardRedisHost(host) {
    const h = String(host || "127.0.0.1");
    if (redisHosts.length && !redisHosts.includes(h)) {
      throw new Error(`redis host not allowed: ${h}`);
    }
    return h;
  }

  ctx.tools.register({
    name: "db_status",
    description: "Whether psql / redis-cli are on PATH; list connection aliases (names only).",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: JSON.stringify(v) }] },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute() {
      return {
        ...(await dbStatus()),
        connectionAliases: Object.keys(connections),
        allowAnyUrl,
        redisHosts,
      };
    },
    presentCall: () => ({ card: "generic", title: "db status" }),
    presentResult: (_a, r) => ({ card: "generic", title: "db status", content: r.content }),
  });

  ctx.tools.register({
    name: "db_psql",
    description: "Read-only psql query (SELECT/WITH/SHOW/EXPLAIN). conn = alias from config.connections or URL if allowAnyUrl.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["sql"],
      properties: {
        sql: { type: "string" },
        conn: { type: "string", description: "Alias or postgres URL" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.output }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const conn = resolveConn(args.conn);
        return await psqlQuery({ sql: args.sql, conn, timeoutMs });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "psql" }),
    presentResult: (_a, r) => ({ card: "generic", title: "psql", content: r.content }),
  });

  ctx.tools.register({
    name: "db_redis",
    description: "Read-only redis-cli (PING/INFO/GET/SCAN/…). Host must be in redisHosts allowlist.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["command"],
      properties: {
        command: { type: "string", description: "e.g. PING or GET mykey" },
        host: { type: "string" },
        port: { type: "number" },
        db: { type: "number" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.output }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const host = guardRedisHost(args.host || "127.0.0.1");
        return await redisCmd({
          command: args.command,
          host,
          port: args.port,
          db: args.db,
          timeoutMs,
        });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "redis-cli" }),
    presentResult: (_a, r) => ({ card: "generic", title: "redis-cli", content: r.content }),
  });
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

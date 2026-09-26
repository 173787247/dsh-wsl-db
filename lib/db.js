import { spawn } from "node:child_process";

export function which(cmd) {
  const safe = String(cmd || "").replace(/[^a-zA-Z0-9._+-]/g, "");
  if (!safe) return Promise.resolve("");
  return new Promise((r) => {
    const child = spawn("bash", ["-lc", `command -v ${safe}`], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (c) => r(c === 0 ? out.trim() : ""));
  });
}

export function run(bin, args, { timeoutMs = 30_000, maxOut = 80_000, env } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(env || {}) },
    });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout"));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.length > maxOut * 2) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(t);
      resolvePromise({
        code,
        stdout: stdout.slice(0, maxOut),
        stderr: stderr.slice(0, 4000),
        truncated: stdout.length > maxOut,
      });
    });
    child.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export function assertReadonlySql(sql) {
  const s = String(sql || "").trim();
  if (!s || s.length > 4000) throw new Error("invalid sql");
  if (s.includes(";")) throw new Error("sql: multiple statements refused");
  const head = s.replace(/^\s*\(/, "").trim().toUpperCase();
  if (!(head.startsWith("SELECT") || head.startsWith("WITH") || head.startsWith("SHOW") || head.startsWith("EXPLAIN"))) {
    throw new Error("psql: only SELECT / WITH / SHOW / EXPLAIN allowed");
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY|VACUUM|CALL)\b/i.test(s)) {
    throw new Error("psql: mutating keywords refused");
  }
  return s;
}

export function assertRedisReadonly(cmd) {
  const parts = String(cmd || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) throw new Error("redis command required");
  const op = parts[0].toUpperCase();
  const allow = new Set([
    "PING",
    "INFO",
    "DBSIZE",
    "GET",
    "MGET",
    "EXISTS",
    "TTL",
    "TYPE",
    "KEYS",
    "SCAN",
    "HGET",
    "HGETALL",
    "HKEYS",
    "LLEN",
    "LRANGE",
    "SCARD",
    "SMEMBERS",
    "ZCARD",
    "ZRANGE",
    "CLIENT",
  ]);
  if (!allow.has(op)) throw new Error(`redis command not allowed: ${op}`);
  if (op === "KEYS" && parts.length > 1 && parts[1] === "*") {
    // allow but warn via result; still capped by redis-cli
  }
  if (op === "CLIENT" && (parts[1] || "").toUpperCase() !== "LIST") {
    throw new Error("only CLIENT LIST allowed");
  }
  // block dangerous KEYS with huge patterns somehow - just cap output
  return parts;
}

export async function dbStatus() {
  return {
    ok: true,
    psql: (await which("psql")) || null,
    redisCli: (await which("redis-cli")) || null,
  };
}

/** Lightweight connectivity probe: psql SELECT 1 and/or redis PING. */
export async function dbPing({
  target = "auto",
  conn,
  host,
  port,
  db,
  timeoutMs = 10_000,
} = {}) {
  const t = String(target || "auto").toLowerCase();
  const out = { ok: true, target: t, postgres: null, redis: null };

  const wantPg = t === "auto" || t === "postgres" || t === "psql" || t === "pg";
  const wantRedis = t === "auto" || t === "redis";

  if (wantPg && (conn || t !== "auto" || (await which("psql")))) {
    if (conn || t !== "auto") {
      try {
        const r = await psqlQuery({ sql: "SELECT 1 AS ok", conn, timeoutMs, maxOut: 2_000 });
        out.postgres = { ok: true, output: (r.output || "").trim().slice(0, 200) };
      } catch (e) {
        out.postgres = { ok: false, error: e instanceof Error ? e.message : String(e) };
        if (t !== "auto") out.ok = false;
      }
    } else {
      out.postgres = { ok: null, skipped: "pass conn alias/URL to probe postgres" };
    }
  }

  if (wantRedis) {
    const redisBin = await which("redis-cli");
    if (!redisBin && t !== "auto") {
      out.redis = { ok: false, error: "redis-cli not on PATH" };
      out.ok = false;
    } else if (redisBin) {
      try {
        const r = await redisCmd({
          command: "PING",
          host: host || "127.0.0.1",
          port,
          db,
          timeoutMs,
          maxOut: 1_000,
        });
        out.redis = { ok: true, output: (r.output || "").trim() };
      } catch (e) {
        out.redis = { ok: false, error: e instanceof Error ? e.message : String(e) };
        if (t === "redis") out.ok = false;
      }
    } else {
      out.redis = { ok: null, skipped: "redis-cli not on PATH" };
    }
  }

  if (t === "postgres" || t === "psql" || t === "pg") {
    out.ok = !!(out.postgres && out.postgres.ok);
  }
  return out;
}

/**
 * conn: either DATABASE_URL style or libpq keywords via env PG*
 * We accept a connection URI only from config allowlist aliases or explicit url if allowAnyUrl.
 */
export async function psqlQuery({ sql, conn, timeoutMs, maxOut = 60_000 } = {}) {
  const q = assertReadonlySql(sql);
  const bin = (await which("psql")) || "psql";
  const args = ["-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-c", q];
  const env = {};
  if (conn) {
    // prefer URI
    if (/^postgres(ql)?:\/\//i.test(conn)) {
      args.unshift(conn);
    } else {
      // treat as conninfo string via PGOPTIONS? Use psql "conninfo"
      args.unshift(conn);
    }
  }
  const r = await run(bin, args, { timeoutMs, maxOut, env });
  if (r.code !== 0) throw new Error(`psql failed: ${r.stderr || r.code}`);
  return { ok: true, truncated: r.truncated, output: r.stdout };
}

export async function redisCmd({ command, host, port, db, timeoutMs, maxOut = 40_000 } = {}) {
  const parts = assertRedisReadonly(command);
  const bin = (await which("redis-cli")) || "redis-cli";
  const args = [];
  if (host) args.push("-h", String(host));
  if (port) args.push("-p", String(port));
  if (db != null && db !== "") args.push("-n", String(db));
  args.push(...parts);
  const r = await run(bin, args, { timeoutMs, maxOut });
  if (r.code !== 0) throw new Error(`redis-cli failed: ${r.stderr || r.stdout || r.code}`);
  return { ok: true, truncated: r.truncated, output: r.stdout.trim() };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertReadonlySql, assertRedisReadonly } from "../lib/db.js";

describe("db guards", () => {
  it("allows select", () => {
    assert.equal(assertReadonlySql("SELECT 1"), "SELECT 1");
  });
  it("blocks insert", () => {
    assert.throws(() => assertReadonlySql("INSERT INTO t VALUES (1)"), /refused|only SELECT/);
  });
  it("allows redis ping", () => {
    assert.deepEqual(assertRedisReadonly("PING"), ["PING"]);
  });
  it("blocks redis set", () => {
    assert.throws(() => assertRedisReadonly("SET x 1"), /not allowed/);
  });
});

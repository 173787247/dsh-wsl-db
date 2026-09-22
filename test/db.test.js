import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertReadonlySql, assertRedisReadonly } from "../lib/db.js";
describe("db", () => {
  it("sql", () => assert.ok(assertReadonlySql("SELECT 1")));
  it("sql block", () => assert.throws(() => assertReadonlySql("DELETE FROM t"), /SELECT|refused/));
  it("redis", () => assert.deepEqual(assertRedisReadonly("PING"), ["PING"]));
});

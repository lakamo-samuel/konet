import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync("src/lib/auth/transport.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const mode of ["development", "production"]) {
  const entries = new Map();
  const context = { exports: {}, process: { env: { NODE_ENV: mode } }, window: { localStorage: { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) } } };
  vm.runInNewContext(compiled, context);
  context.exports.saveAccessToken("issued-access-token");
  assert.equal(context.exports.readAccessToken(), mode === "development" ? "issued-access-token" : null);
  assert.equal(entries.size, mode === "development" ? 1 : 0);
  context.exports.saveAccessToken();
  assert.equal(entries.size, 0);
  context.window.localStorage.getItem = () => { throw new Error("storage disabled"); };
  context.window.localStorage.setItem = () => { throw new Error("storage disabled"); };
  assert.equal(context.exports.readAccessToken(), null);
  assert.doesNotThrow(() => context.exports.saveAccessToken("token"));
}
console.log("Development persistence, production privacy, clearing and unavailable storage passed.");

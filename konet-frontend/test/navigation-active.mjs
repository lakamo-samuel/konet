import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const output = ts.transpileModule(
  readFileSync("src/lib/constants/navigation.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { isNavigationActive } = context.exports;

assert.equal(isNavigationActive("/disputes", "/disputes"), true);
assert.equal(isNavigationActive("/disputes/case-id", "/disputes"), true);
assert.equal(isNavigationActive("/disputes", "/jobs"), false);
assert.equal(isNavigationActive("/jobs/job-id/dispute", "/jobs"), true);
console.log("Navigation active-state checks passed for jobs and disputes.");

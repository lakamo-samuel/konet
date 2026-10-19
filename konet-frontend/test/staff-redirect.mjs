import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const output = ts.transpileModule(
  readFileSync("src/features/admin/lib/staff-navigation.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { staffVerificationDestination } = context.exports;

assert.equal(staffVerificationDestination("/admin"), "/admin");
assert.equal(staffVerificationDestination("/admin/providers"), "/admin/providers");
assert.equal(staffVerificationDestination("/admin/providers/id"), "/admin/providers/id");
assert.equal(staffVerificationDestination("/admin/security"), "/admin");
assert.equal(staffVerificationDestination("https://example.com"), "/admin");
assert.equal(staffVerificationDestination("//example.com"), "/admin");
assert.equal(staffVerificationDestination("/admin/../discover"), "/admin");

console.log("Staff verification redirect checks passed.");

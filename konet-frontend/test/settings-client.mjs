import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile = (path) =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const policy = { exports: {} };
vm.runInNewContext(compile("src/lib/auth/commands.ts"), policy);
let token = "development-access";
let response;
let rejected = false;
let errorInterceptor;
let refreshes = 0;
const axios = {
  create: () => ({
    interceptors: {
      request: { use: () => {} },
      response: {
        use: (_success, error) => {
          errorInterceptor = error;
        },
      },
    },
    post: async () => {
      if (rejected) throw new Error("request failed");
      return { data: response };
    },
    get: async () => ({ data: {} }),
  }),
  isAxiosError: () => false,
};
const context = {
  exports: {},
  require: (name) => {
    if (name === "axios") return { default: axios };
    if (name === "@/lib/auth/commands") return policy.exports;
    if (name === "@/lib/auth/transport")
      return {
        readAccessToken: () => token,
        saveAccessToken: (value) => {
          token = value;
        },
      };
    if (name === "@/lib/auth/refresh-client")
      return {
        refreshSession: async () => {
          refreshes++;
          throw new Error("refresh should not run");
        },
      };
    throw new Error(name);
  },
};
vm.runInNewContext(compile("src/data/access/client.ts"), context);
for (const name of [
  "changePassword",
  "confirmEmailChange",
  "deactivateAccount",
]) {
  token = "development-access";
  response = { data: { success: true } };
  rejected = false;
  assert.equal((await context.exports.command(name, {})).success, true);
  assert.equal(token, undefined);
  token = "development-access";
  rejected = true;
  await assert.rejects(() => context.exports.command(name, {}));
  assert.equal(token, "development-access");
  const error = {
    response: { status: 401 },
    config: { data: JSON.stringify({ name, input: {} }) },
  };
  await assert.rejects(() => errorInterceptor(error));
  assert.equal(refreshes, 0);
}
rejected = false;
token = "development-access";
response = { data: { challengeId: "challenge" } };
await context.exports.command("requestEmailChange", {});
assert.equal(token, "development-access");
console.log(
  "Session-ending commands clear development tokens only on success; failed credential actions do not retry through refresh.",
);

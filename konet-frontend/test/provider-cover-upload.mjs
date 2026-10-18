import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync("src/lib/uploads/provider-cover-file.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const ticket = {
  publicId: "konet/provider-covers/user/image-id",
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  method: "POST",
  fields: { api_key: "public-key", signature: "signed-ticket", type: "upload" },
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};
const coverImageUrl =
  "https://res.cloudinary.com/test-cloud/image/upload/cover.webp";
const calls = [];
let fetched = 0;
const context = {
  exports: {},
  URL,
  FormData,
  AbortSignal,
  Error,
  require: () => ({
    command: async (name, input) => {
      calls.push([name, input]);
      if (name === "createProviderCoverUpload") return ticket;
      if (name === "completeProviderCoverUpload") return { coverImageUrl };
      throw new Error(`Unexpected command: ${name}`);
    },
  }),
  fetch: async (target, options) => {
    fetched++;
    assert.equal(String(target), ticket.uploadUrl);
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal);
    for (const [key, value] of Object.entries(ticket.fields))
      assert.equal(options.body.get(key), value);
    assert.equal(options.body.get("file").name, "cover.webp");
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  },
};
vm.runInNewContext(compiled, context);
const upload = context.exports.uploadProviderCover;
const file = new File(["image"], "cover.webp", { type: "image/webp" });
assert.equal(await upload(file, new AbortController().signal), coverImageUrl);
assert.equal(
  JSON.stringify(calls),
  JSON.stringify([
    ["createProviderCoverUpload", { contentType: "image/webp", sizeBytes: 5 }],
    [
      "completeProviderCoverUpload",
      { publicId: "konet/provider-covers/user/image-id" },
    ],
  ]),
);
assert.equal(fetched, 1);

await assert.rejects(
  upload({ type: "text/html", size: 5 }, new AbortController().signal),
  /JPEG, PNG or WebP/,
);
await assert.rejects(
  upload(
    { type: "image/png", size: 5 * 1024 * 1024 + 1 },
    new AbortController().signal,
  ),
  /5 MiB/,
);
assert.equal(fetched, 1);

ticket.uploadUrl = "https://untrusted.example/upload";
await assert.rejects(
  upload(file, new AbortController().signal),
  /invalid destination/,
);
assert.equal(fetched, 1);
console.log(
  "Provider cover upload checks passed: validation, signed multipart upload, credential isolation, destination validation and URL completion.",
);

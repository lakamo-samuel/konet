import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync("src/lib/uploads/public-image.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const ticket = {
  publicId: "konet/avatars/user/image-id",
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  method: "POST",
  fields: { api_key: "public-key", signature: "signed-ticket", type: "upload" },
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};
const avatarUrl =
  "https://res.cloudinary.com/test-cloud/image/upload/avatar.webp";
let destination = ticket.uploadUrl;
let transferStatus = 200;
let calls = [];
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
      if (name === "createAvatarUpload") return ticket;
      if (name === "completeAvatarUpload") return { avatarUrl };
      throw new Error(`Unexpected command: ${name}`);
    },
  }),
  fetch: async (target, options) => {
    fetched++;
    assert.equal(String(target), destination);
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers, undefined);
    assert.ok(options.signal);
    for (const [key, value] of Object.entries(ticket.fields))
      assert.equal(options.body.get(key), value);
    assert.equal(options.body.get("file").name, "portrait.webp");
    return {
      ok: transferStatus < 400,
      status: transferStatus,
      json: async () => ({ error: { message: "Cloudinary rejected image" } }),
    };
  },
};
vm.runInNewContext(compiled, context);
const upload = context.exports.uploadPublicImage;
const file = new File(["image"], "portrait.webp", { type: "image/webp" });
const url = await upload(
  file,
  new AbortController().signal,
  async (input) => {
    calls.push(["createAvatarUpload", input]);
    return ticket;
  },
  async (publicId) => {
    calls.push(["completeAvatarUpload", { publicId }]);
    return avatarUrl;
  },
);
assert.equal(url, avatarUrl);
assert.equal(
  JSON.stringify(calls),
  JSON.stringify([
    ["createAvatarUpload", { contentType: "image/webp", sizeBytes: 5 }],
    ["completeAvatarUpload", { publicId: ticket.publicId }],
  ]),
);
assert.equal(fetched, 1);

await assert.rejects(
  upload(
    { type: "text/html", size: 5 },
    new AbortController().signal,
    async () => ticket,
    async () => avatarUrl,
  ),
  /JPEG, PNG or WebP/,
);
await assert.rejects(
  upload(
    { type: "image/png", size: 5 * 1024 * 1024 + 1 },
    new AbortController().signal,
    async () => ticket,
    async () => avatarUrl,
  ),
  /5 MiB/,
);
assert.equal(fetched, 1);

destination = "https://untrusted.example/upload";
ticket.uploadUrl = destination;
await assert.rejects(upload(file, new AbortController().signal, async (input) => {
  calls.push(["createAvatarUpload", input]);
  return ticket;
}, async () => avatarUrl), /invalid destination/);
assert.equal(fetched, 1);

destination = ticket.uploadUrl;
ticket.uploadUrl =
  "https://api.cloudinary.com/v1_1/test-cloud/image/upload";
destination = ticket.uploadUrl;
transferStatus = 400;
await assert.rejects(
  upload(file, new AbortController().signal, async (input) => {
    calls.push(["createAvatarUpload", input]);
    return ticket;
  }, async () => avatarUrl),
  /Image upload failed \(400\): Cloudinary rejected image/,
);
assert.equal(calls.at(-1)[0], "createAvatarUpload");
console.log(
  "Avatar upload checks passed: file limits, signed multipart upload, credential isolation, destination validation and server verification.",
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compiled = ts.transpileModule(
  readFileSync("src/lib/uploads/private-file.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
let ticketCalls = 0;
let expectedPurpose = "student_evidence";
let fetched = 0;
let url = "https://api.cloudinary.com/v1_1/test/image/upload";
let failTransfer = false;
let transferResponse = {
  status: 400,
  json: async () => ({ error: { message: "Invalid file" } }),
};
const fields = {
  api_key: "public-key",
  signature: "signed-ticket",
  type: "authenticated",
  moderation: "perception_point",
  overwrite: "false",
};
const upload = { id: "private-upload-id", status: "pending" };
const context = {
  exports: {},
  URL,
  FormData,
  AbortSignal,
  Error,
  require: () => ({
    command: async (name, input) => {
      ticketCalls++;
      assert.equal(name, "createUpload");
      assert.equal(input.purpose, expectedPurpose);
      assert.equal(input.fileName, "student.pdf");
      assert.equal(input.sizeBytes, 7);
      return { upload, uploadUrl: url, method: "POST", fields };
    },
  }),
  fetch: async (target, options) => {
    fetched++;
    assert.equal(String(target), url);
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers, undefined);
    assert.ok(options.signal);
    for (const [key, value] of Object.entries(fields))
      assert.equal(options.body.get(key), value);
    assert.equal(options.body.get("file").name, "student.pdf");
    return { ok: !failTransfer, ...transferResponse };
  },
};
vm.runInNewContext(compiled, context);
const send = context.exports.uploadPrivateFile;
const file = new File(["content"], "student.pdf", { type: "application/pdf" });
const signal = new AbortController().signal;
let receivedTicket;
assert.equal(
  await send(
    file,
    "student_evidence",
    signal,
    (value) => (receivedTicket = value),
  ),
  upload,
);
assert.equal(receivedTicket, upload);
assert.equal(fetched, 1);
await assert.rejects(
  send(
    { name: "student.pdf", type: "application/pdf", size: 10485761 },
    "student_evidence",
    signal,
    () => {},
  ),
  /10 MiB/,
);
await assert.rejects(
  send(
    { name: "student.pdf", type: "text/html", size: 7 },
    "student_evidence",
    signal,
    () => {},
  ),
  /JPEG/,
);
assert.equal(ticketCalls, 1);
url = "https://untrusted.example/upload";
await assert.rejects(
  send(file, "student_evidence", signal, () => {}),
  /invalid destination/,
);
assert.equal(fetched, 1);
url = "https://api.cloudinary.com/v1_1/test/image/upload";
failTransfer = true;
await assert.rejects(
  send(file, "student_evidence", signal, () => {}),
  /Document upload failed \(400\): Invalid file/,
);
failTransfer = false;
transferResponse = {
  status: 503,
  json: async () => {
    throw new Error("not JSON");
  },
};
failTransfer = true;
await assert.rejects(
  send(file, "student_evidence", signal, () => {}),
  /Document upload failed \(HTTP 503\)/,
);
failTransfer = false;
transferResponse = {
  status: 400,
  json: async () => ({ error: { message: "Invalid file" } }),
};
expectedPurpose = "provider_evidence";
assert.equal(await send(file, expectedPurpose, signal, () => {}), upload);
console.log(
  "Private upload checks passed: file limits, multipart fields, credential isolation, destination validation and transfer failure.",
);

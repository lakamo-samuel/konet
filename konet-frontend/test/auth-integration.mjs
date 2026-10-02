import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
const development = process.argv.includes("--development");
const uid = "00000000-0000-4000-8000-000000000001";
const universityId = "00000000-0000-4000-8000-000000000002";
const campusId = "00000000-0000-4000-8000-000000000003";
const university = {
  id: universityId,
  name: "Integration University",
  shortName: "TEST",
  city: "Lagos",
  state: "Lagos",
  campuses: [{ id: campusId, name: "Main Campus" }],
};
const users = new Map();
let serial = 0;
const access = new Map();
const refresh = new Map();
let forgotAvailable = true;
let registered;
const issue = (user) => {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 900,
      sub: user.id,
      serial: ++serial,
    }),
  ).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.integration-signature`;
  const r = `refresh.integration.${serial}`;
  access.set(token, user);
  refresh.set(r, user);
  return { token, r };
};
const backend = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let raw = "";
  for await (const part of req) raw += part;
  const body = raw ? JSON.parse(raw) : {};
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(data === undefined ? "" : JSON.stringify(data));
  };
  const auth = access.get(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  const authResult = (user) => {
    const { token, r } = issue(user);
    res.setHeader(
      "Set-Cookie",
      `konet_refresh=${r}; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Expires=${new Date(Date.now() + 3600000).toUTCString()}`,
    );
    send(200, { accessToken: token, user });
  };
  if (url.pathname === "/api/v1/universities") return send(200, [university]);
  if (url.pathname === `/api/v1/universities/${universityId}`)
    return send(200, university);
  if (url.pathname === "/api/v1/providers") return send(200, []);
  if (url.pathname === "/api/v1/auth/register") {
    registered = body;
    assert.equal(body.universityId, universityId);
    assert.equal(body.campusId, campusId);
    assert.equal(typeof body.fullName, "string");
    assert.equal(body.name, undefined);
    const user = {
      id: uid,
      fullName: body.fullName,
      email: body.email,
      avatarUrl: null,
      universityId,
      campusId,
      studentVerificationStatus: "unverified",
      accountStatus: "active",
    };
    users.set(body.email, { user, password: body.password });
    return authResult(user);
  }
  if (url.pathname === "/api/v1/auth/login") {
    const found = users.get(body.email);
    if (!found || found.password !== body.password)
      return send(401, {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    return authResult(found.user);
  }
  if (url.pathname === "/api/v1/auth/refresh") {
    const r = (req.headers.cookie ?? "").match(/konet_refresh=([^;]+)/)?.[1];
    const user = refresh.get(r);
    if (!user)
      return send(401, {
        code: "SESSION_REVOKED",
        message: "Session has ended.",
      });
    refresh.delete(r);
    return authResult(user);
  }
  if (url.pathname === "/api/v1/auth/logout") {
    const r = (req.headers.cookie ?? "").match(/konet_refresh=([^;]+)/)?.[1];
    const user = refresh.get(r);
    refresh.delete(r);
    if (user)
      for (const [token, owner] of access)
        if (owner.id === user.id) access.delete(token);
    return send(204);
  }
  if (url.pathname === "/api/v1/auth/forgot-password")
    return forgotAvailable
      ? send(202, { message: "Recovery queued." })
      : send(503, {
          code: "EMAIL_DELIVERY_NOT_CONFIGURED",
          message: "Email delivery is not configured.",
        });
  if (url.pathname === "/api/v1/auth/reset-password") {
    assert.equal(body.token, "test-recovery-token");
    users.get("student@example.com").password = body.password;
    return send(200, { message: "Password reset." });
  }
  if (!auth)
    return send(401, {
      code: "SESSION_REQUIRED",
      message: "Authentication required.",
    });
  if (url.pathname === "/api/v1/auth/me")
    return send(200, { ...auth, roles: [] });
  if (url.pathname === "/api/v1/me/provider-profile")
    return send(404, {
      code: "PROVIDER_PROFILE_REQUIRED",
      message: "Create a provider profile.",
    });
  if (url.pathname === "/api/v1/notifications") return send(200, []);
  return send(404, { code: "NOT_FOUND", message: "Not found." });
});
backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const apiPort = backend.address().port;
const reservation = http.createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    development ? "dev" : "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: development ? "development" : "production",
      KONET_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (c) => (output += c));
child.stderr.on("data", (c) => (output += c));
const base = `http://127.0.0.1:${port}`;
const jar = new Map();
let checks = 0;
const cookie = () =>
  [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
async function call(
  path,
  { method = "GET", body, origin = base, rawCookie = cookie(), bearer } = {},
) {
  const result = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(rawCookie ? { Cookie: rawCookie } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(method === "POST"
        ? { Origin: origin, "Content-Type": "application/json" }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of result.headers.getSetCookie()) {
    const first = c.split(";")[0];
    const split = first.indexOf("=");
    const key = first.slice(0, split);
    const value = first.slice(split + 1);
    if (value) jar.set(key, value);
    else jar.delete(key);
  }
  const text = await result.text();
  return {
    status: result.status,
    headers: result.headers,
    text,
    json: () => JSON.parse(text),
  };
}
const command = (name, input) =>
  call("/api/frontend", { method: "POST", body: { name, input } });
const query = (name, input = {}) =>
  call(
    `/api/frontend?name=${name}&input=${encodeURIComponent(JSON.stringify(input))}`,
  );
try {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(base + "/sign-in");
      break;
    } catch {
      if (child.exitCode !== null) throw new Error(output);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const signupPage = await call("/sign-up");
  assert.equal(signupPage.status, 200);
  assert.match(signupPage.text, /Select your university/);
  checks++;
  const directory = await query("universities");
  assert.equal(directory.status, 200);
  assert.equal(directory.json().data[0].campusOptions[0].id, campusId);
  checks++;
  const register = await command("signUp", {
    name: "Integration Student",
    email: "student@example.com",
    password: "original-test-password",
    universityId,
    campusId,
  });
  assert.equal(register.status, 200);
  assert.equal(registered.fullName, "Integration Student");
  if (development) assert.equal(register.json().authentication.accessToken, jar.get("konet_access"));
  else assert.doesNotMatch(register.text, /accessToken|refreshToken/);
  assert.doesNotMatch(register.text, /refreshToken/);
  assert.ok(jar.has("konet_access"));
  assert.ok(jar.has("konet_refresh"));
  assert.ok(!jar.has("konet_session"));
  for (const c of register.headers
    .getSetCookie()
    .filter(
      (c) => c.startsWith("konet_access=") || c.startsWith("konet_refresh="),
    )) {
    assert.match(c, /HttpOnly/i);
    if (development) assert.doesNotMatch(c, /; Secure/i);
    else assert.match(c, /Secure/i);
    assert.match(c, /SameSite=lax/i);
  }
  checks++;
  if (development) {
    const tokenOnly = await call('/api/frontend?name=currentUser&input=%7B%7D', { rawCookie: '', bearer: register.json().authentication.accessToken });
    assert.equal(tokenOnly.status, 200);
    const forged = await call('/api/frontend?name=currentUser&input=%7B%7D', { rawCookie: '', bearer: 'forged.token.value' });
    assert.equal(forged.status, 401);
    checks++;
  }
  const me = await query("currentUser");
  assert.equal(me.status, 200);
  assert.equal(me.json().data.name, "Integration Student");
  assert.equal(me.json().data.campus, "Main Campus");
  assert.equal(me.json().data.studentVerification, "unverified");
  checks++;
  const profile = await call("/profile");
  assert.equal(profile.status, 200);
  assert.match(profile.text, /Verification needed/);
  assert.doesNotMatch(profile.text, /Your university membership is confirmed/);
  checks++;
  const forged = await call("/api/frontend?name=currentUser&input=%7B%7D", {
    rawCookie:
      "konet_session=admin; konet_student_verified=true; konet_provider=admin",
  });
  assert.equal(forged.status, 401);
  checks++;
  const forgedAccess = await call(
    "/api/frontend?name=currentUser&input=%7B%7D",
    { rawCookie: "konet_access=forged; konet_student_verified=true" },
  );
  assert.equal(forgedAccess.status, 401);
  checks++;
  const blocked = await call("/api/frontend/session", {
    method: "POST",
    body: {},
    origin: "https://untrusted.example",
  });
  assert.equal(blocked.status, 403);
  checks++;
  const blockedCommand = await call("/api/frontend", {
    method: "POST",
    body: { name: "signOut", input: {} },
    origin: "https://untrusted.example",
  });
  assert.equal(blockedCommand.status, 403);
  checks++;
  const oldRefresh = jar.get("konet_refresh");
  const refreshed = await call("/api/frontend/session", {
    method: "POST",
    body: {},
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(jar.get("konet_refresh"), oldRefresh);
  if (development) assert.equal(refreshed.json().accessToken, jar.get("konet_access"));
  else assert.doesNotMatch(refreshed.text, /accessToken|refreshToken/);
  assert.equal((await query("currentUser")).status, 200);
  checks++;
  jar.delete("konet_access");
  assert.equal(
    (await call("/api/frontend/session", { method: "POST", body: {} })).status,
    200,
  );
  assert.equal((await query("currentUser")).status, 200);
  checks++;
  jar.set("konet_refresh", "invalid-refresh");
  assert.equal(
    (await call("/api/frontend/session", { method: "POST", body: {} })).status,
    401,
  );
  assert.ok(!jar.has("konet_access"));
  assert.ok(!jar.has("konet_refresh"));
  assert.equal(
    (
      await command("signIn", {
        email: "student@example.com",
        password: "original-test-password",
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (await command("forgotPassword", { email: "student@example.com" })).status,
    200,
  );
  forgotAvailable = false;
  const missing = await command("forgotPassword", {
    email: "student@example.com",
  });
  assert.equal(missing.status, 503);
  assert.equal(missing.json().error.code, "EMAIL_DELIVERY_NOT_CONFIGURED");
  checks++;
  const resetPage = await call("/reset-password");
  assert.equal(resetPage.status, 200);
  assert.match(resetPage.text, /Confirm password/);
  const reset = await command("resetPassword", {
    token: "test-recovery-token",
    password: "replacement-test-password",
  });
  assert.equal(reset.status, 200);
  assert.ok(!jar.has("konet_access"));
  assert.ok(!jar.has("konet_refresh"));
  checks++;
  assert.equal(
    (
      await command("signIn", {
        email: "student@example.com",
        password: "original-test-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await command("signIn", {
        email: "student@example.com",
        password: "replacement-test-password",
      })
    ).status,
    200,
  );
  checks++;
  const saved = cookie();
  assert.equal((await command("signOut", {})).status, 200);
  assert.ok(!jar.has("konet_access"));
  assert.ok(!jar.has("konet_refresh"));
  assert.equal(
    (
      await call("/api/frontend?name=currentUser&input=%7B%7D", {
        rawCookie: saved,
      })
    ).status,
    401,
  );
  checks++;
  console.log(
    `Passed ${checks} frontend HTTP integration checks against a local mocked backend. No emails or payments sent.`,
  );
} finally {
  child.kill("SIGTERM");
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
}

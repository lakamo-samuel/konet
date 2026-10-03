import { providerFixture } from "./provider-fixture.mjs";
import { verificationFixture } from "./verification-fixture.mjs";
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
const verification = verificationFixture(universityId, campusId);
const provider = providerFixture(verification);
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
  if (verification.handle(url, req.method, body, auth, send)) return;
  if (provider.handle(url, req.method, body, auth, send)) return;
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
  if (development)
    assert.equal(
      register.json().authentication.accessToken,
      jar.get("konet_access"),
    );
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
    const tokenOnly = await call(
      "/api/frontend?name=currentUser&input=%7B%7D",
      { rawCookie: "", bearer: register.json().authentication.accessToken },
    );
    assert.equal(tokenOnly.status, 200);
    const forged = await call("/api/frontend?name=currentUser&input=%7B%7D", {
      rawCookie: "",
      bearer: "forged.token.value",
    });
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
  const methods = await query("verificationMethods", { universityId });
  assert.deepEqual(methods.json().data.approvedEmailDomains, ["test.edu"]);
  const unauthenticatedHistory = await call(
    "/api/frontend?name=studentVerifications&input=%7B%7D",
    { rawCookie: "" },
  );
  assert.equal(unauthenticatedHistory.status, 401);
  assert.equal((await query("studentVerifications")).json().data.length, 0);
  checks++;
  verification.configure({ email: false });
  assert.equal(
    (await command("requestVerificationCode", { email: "student@test.edu" }))
      .status,
    503,
  );
  verification.configure({ email: true });
  const challenge = await command("requestVerificationCode", {
    email: "student@test.edu",
  });
  assert.equal(challenge.status, 200);
  assert.equal(challenge.json().data.delivery, "email");
  assert.doesNotMatch(challenge.text, /000123/);
  assert.equal(
    (await query("currentUser")).json().data.studentVerification,
    "pending",
  );
  assert.equal(
    (
      await command("confirmVerificationCode", {
        challengeId: challenge.json().data.challengeId,
        code: "111111",
      })
    ).status,
    400,
  );
  verification.expireChallenge();
  assert.equal(
    (
      await command("confirmVerificationCode", {
        challengeId: challenge.json().data.challengeId,
        code: "000123",
      })
    ).status,
    400,
  );
  const freshChallenge = await command("requestVerificationCode", {
    email: "student@test.edu",
  });
  assert.equal(
    (
      await command("confirmVerificationCode", {
        challengeId: freshChallenge.json().data.challengeId,
        code: "000123",
      })
    ).json().data.status,
    "verified",
  );
  assert.equal(
    (await query("currentUser")).json().data.studentVerification,
    "verified",
  );
  checks++;
  const fixtureUser = users.get("student@example.com").user;
  fixtureUser.studentVerificationStatus = "not_submitted"; // Independent document scenario.
  const uploadInput = {
    purpose: "student_evidence",
    fileName: "student-card.pdf",
    contentType: "application/pdf",
    sizeBytes: 4096,
  };
  verification.configure({ storage: false });
  assert.equal((await command("createUpload", uploadInput)).status, 503);
  verification.configure({ storage: true });
  assert.equal(
    (await command("createUpload", { ...uploadInput, sizeBytes: 10485761 }))
      .status,
    400,
  );
  assert.equal(
    (
      await command("createUpload", {
        ...uploadInput,
        contentType: "text/html",
      })
    ).status,
    400,
  );
  const ticket = (await command("createUpload", uploadInput)).json().data;
  assert.equal(ticket.fields.type, "authenticated");
  assert.doesNotMatch(JSON.stringify(ticket), /api_secret/);
  assert.equal(
    (await query("upload", { id: "someone-elses-upload" })).status,
    404,
  );
  const document = {
    method: "student_id",
    studentNumber: "MAT/123",
    evidenceObjectKey: ticket.upload.objectKey,
  };
  assert.equal((await command("submitVerification", document)).status, 409);
  assert.equal(
    (await command("completeUpload", { id: ticket.upload.id })).json().data
      .status,
    "scanning",
  );
  assert.equal((await command("submitVerification", document)).status, 409);
  assert.equal(
    (await command("completeUpload", { id: ticket.upload.id })).json().data
      .status,
    "ready",
  );
  assert.equal(
    (await command("submitVerification", document)).json().data.status,
    "pending",
  );
  assert.equal((await command("submitVerification", document)).status, 409);
  checks++;
  verification.decide(
    fixtureUser,
    "requires_more_information",
    "Please upload a legible current student card.",
  );
  const review = (await query("studentVerifications")).json().data[0];
  assert.equal(review.reason, "Please upload a legible current student card.");
  assert.equal(
    (await query("currentUser")).json().data.studentVerification,
    "requires_more_information",
  );
  const replacement = (await command("createUpload", uploadInput)).json().data;
  await command("completeUpload", { id: replacement.upload.id });
  await command("completeUpload", { id: replacement.upload.id });
  assert.equal(
    (
      await command("submitVerification", {
        method: "manual_document",
        evidenceObjectKey: replacement.upload.objectKey,
      })
    ).json().data.status,
    "pending",
  );
  checks++;
  verification.configure({ rejectScan: true });
  const failedScan = (await command("createUpload", uploadInput)).json().data;
  assert.equal(
    (await command("completeUpload", { id: failedScan.upload.id })).json().data
      .status,
    "rejected",
  );
  assert.equal(
    (await command("deleteUpload", { id: failedScan.upload.id })).json().data
      .success,
    true,
  );
  verification.configure({ rejectScan: false });
  const unused = (await command("createUpload", uploadInput)).json().data;
  assert.equal(
    (await command("deleteUpload", { id: unused.upload.id })).json().data
      .success,
    true,
  );
  checks++;
  const profileInput = {
    professionalTitle: "Campus photographer",
    bio: "I create portraits and event photography for students on campus.",
    responseTimeMinutes: 60,
  };
  assert.equal((await query("onboarding")).json().data.profile, null);
  assert.equal(
    (await command("createProviderProfile", profileInput)).status,
    403,
  );
  fixtureUser.studentVerificationStatus = "verified";
  const profileRecord = await command("createProviderProfile", profileInput);
  assert.equal(profileRecord.json().data.status, "draft");
  assert.equal(
    (await query("currentUser")).json().data.providerProfileId,
    profileRecord.json().data.id,
  );
  assert.equal((await command("publishProvider", {})).status, 403);
  assert.equal((await command("submitProviderProfile", {})).status, 409);
  assert.deepEqual(
    (await query("categories")).json().data[0].id,
    provider.categoryId,
  );
  checks++;
  const serviceRecord = await command("createProviderService", {
    categoryId: provider.categoryId,
    title: "Campus portraits",
    description:
      "A portrait session with edited photographs delivered digitally.",
    pricingType: "starting_from",
    priceMinor: 150050,
    currency: "NGN",
  });
  assert.equal(serviceRecord.json().data.priceMinor, 150050);
  assert.equal(serviceRecord.json().data.status, "draft");
  assert.equal(
    (
      await command("updateProviderService", {
        id: serviceRecord.json().data.id,
        values: { status: "active" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await command("saveOnboarding", {
        step: "service",
        values: { pricingType: "custom_quote" },
      })
    ).json().data.steps.services.values.pricingType,
    "custom_quote",
  );
  const portfolioRecord = await command("createPortfolioItem", {
    type: "external_link",
    title: "Student portrait project",
    externalUrl: "https://portfolio.example/project",
  });
  assert.equal(portfolioRecord.json().data.type, "external_link");
  assert.equal(
    (
      await command("updatePortfolioItem", {
        id: portfolioRecord.json().data.id,
        values: {
          type: "project",
          title: "Updated project",
          description: "Portrait project case study",
        },
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await command("submitProviderEvidence", {
        dimension: "identity",
        evidenceObjectKey: "unscanned-upload",
      })
    ).status,
    409,
  );
  async function providerEvidence(dimension) {
    const ticket = (
      await command("createUpload", {
        ...uploadInput,
        purpose: "provider_evidence",
      })
    ).json().data;
    assert.equal(ticket.upload.purpose, "provider_evidence");
    await command("completeUpload", { id: ticket.upload.id });
    await command("completeUpload", { id: ticket.upload.id });
    return command("submitProviderEvidence", {
      dimension,
      evidenceObjectKey: ticket.upload.objectKey,
    });
  }
  assert.equal(
    (await providerEvidence("identity")).json().data.status,
    "pending",
  );
  assert.equal((await query("onboarding")).json().data.canSubmit, false);
  assert.equal((await providerEvidence("work")).json().data.status, "pending");
  const completeDraft = (await query("onboarding")).json().data;
  assert.equal(completeDraft.canSubmit, true);
  assert.equal(
    completeDraft.verification.find((v) => v.dimension === "cac").status,
    "not_submitted",
  );
  assert.equal(
    (await command("submitProviderProfile", {})).json().data.reviewStatus,
    "pending",
  );
  assert.equal(
    (await command("updateProviderProfile", profileInput)).status,
    409,
  );
  assert.equal((await command("publishProvider", {})).status, 403);
  checks++;
  provider.requestCorrection();
  const correction = (await query("onboarding")).json().data;
  assert.equal(correction.profile.reviewReason, "Correct identity evidence.");
  assert.equal(
    correction.verification[0].reason,
    "Upload a clearer identity document.",
  );
  assert.equal((await providerEvidence("identity")).json().data.revision, 2);
  assert.equal((await command("submitProviderProfile", {})).status, 200);
  provider.approve();
  assert.equal((await query("onboarding")).json().data.profile.status, "draft");
  assert.equal((await query("onboarding")).json().data.canPublish, true);
  assert.equal(
    (await command("publishProvider", {})).json().data.status,
    "active",
  );
  assert.equal(
    (
      await command("updateProviderService", {
        id: serviceRecord.json().data.id,
        values: { status: "active" },
      })
    ).json().data.status,
    "active",
  );
  checks++;
  const publicPortfolio = await query("portfolio", {
    providerId: profileRecord.json().data.id,
  });
  assert.equal(publicPortfolio.json().data[0].title, "Updated project");
  assert.equal(publicPortfolio.json().data[0].image, "");
  assert.equal(
    publicPortfolio.json().data[0].externalUrl,
    "https://portfolio.example/project",
  );
  const publicPage = await call(`/providers/${profileRecord.json().data.id}`);
  assert.equal(publicPage.status, 200);
  assert.match(publicPage.text, /Updated project/);
  assert.match(publicPage.text, /View project/);
  checks++;
  assert.equal(
    (
      await command("deletePortfolioItem", {
        id: portfolioRecord.json().data.id,
      })
    ).json().data.success,
    true,
  );
  assert.equal(
    (
      await command("updateProviderProfile", {
        ...profileInput,
        bio: "Updated public bio describing my portrait photography and campus event work.",
      })
    ).json().data.reviewStatus,
    "not_submitted",
  );
  assert.equal((await query("onboarding")).json().data.canPublish, false);
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
  if (development)
    assert.equal(refreshed.json().accessToken, jar.get("konet_access"));
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

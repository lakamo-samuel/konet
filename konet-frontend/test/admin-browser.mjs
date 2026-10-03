import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, expect } from "@playwright/test";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = {
  id: id(1),
  fullName: "Test Administrator",
  email: "admin@example.com",
  universityId: id(2),
  campusId: id(3),
  studentVerificationStatus: "verified",
  roles: ["admin"],
  avatarUrl: null,
};
const university = {
  id: id(2),
  name: "Test University",
  shortName: "TEST",
  slug: "test",
  city: "Lagos",
  state: "Lagos",
  country: "Nigeria",
  isActive: true,
  campuses: [{ id: id(3), name: "Main", slug: "main", isActive: true }],
};
const target = {
  ...admin,
  id: id(4),
  fullName: "Test Student",
  email: "student@example.com",
  accountStatus: "active",
  roles: [],
};
let enabled = false,
  verified = false;
const calls = [];
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
const rows = {
  users: [target],
  "student-verifications": [
    {
      id: id(10),
      userId: target.id,
      method: "student_id",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ],
  "provider-verifications": [
    {
      id: id(11),
      providerId: id(12),
      dimension: "identity",
      status: "pending",
      revision: 1,
      submittedAt: new Date().toISOString(),
    },
  ],
  providers: [
    {
      id: id(12),
      professionalTitle: "Student designer",
      bio: "Creates design work",
      status: "pending_verification",
      reviewStatus: "pending",
      reviewRevision: 1,
      applicant: { fullName: target.fullName },
      verification: [],
      services: [],
      portfolio: [],
    },
  ],
  disputes: [
    {
      id: id(13),
      reason: "Work incomplete",
      description: "Client complaint details",
      status: "open",
      jobId: id(14),
      createdAt: new Date().toISOString(),
    },
  ],
  payments: [
    {
      id: id(15),
      amountMinor: 100000,
      providerAmountMinor: 90000,
      platformFeeMinor: 10000,
      status: "funded",
      currency: "NGN",
      createdAt: new Date().toISOString(),
    },
  ],
  payouts: [
    {
      id: id(16),
      amountMinor: 90000,
      status: "failed",
      gatewayStatus: "failed",
      createdAt: new Date().toISOString(),
    },
  ],
  reconciliations: [],
  universities: [university],
  categories: [
    {
      id: id(17),
      name: "Design",
      slug: "design",
      parentId: null,
      isActive: true,
    },
  ],
  "audit-events": [
    {
      id: id(18),
      action: "staff_role.granted",
      actorId: admin.id,
      resourceType: "user",
      resourceId: target.id,
      reason: "Test reason",
      createdAt: new Date().toISOString(),
    },
  ],
};
const backend = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const path = new URL(req.url, "http://localhost").pathname;
  calls.push({ method: req.method, path, body });
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(data === undefined ? "" : JSON.stringify(data));
  };
  if (path === "/api/v1/providers" || path === "/api/v1/categories") return send(200, []);
  if (path === "/api/v1/universities") return send(200, [university]);
  if (path === "/api/v1/auth/login" || (path === "/api/v1/auth/refresh" && req.headers.cookie?.includes("konet_refresh=test-refresh"))) {
    res.setHeader(
      "Set-Cookie",
      `konet_refresh=test-refresh; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Expires=${new Date(Date.now() + 3600000).toUTCString()}`,
    );
    return send(200, { accessToken: token, user: admin });
  }
  if (path === `/api/v1/universities/${university.id}`)
    return send(200, university);
  if (req.headers.authorization !== `Bearer ${token}`)
    return send(401, { code: "SESSION_REQUIRED", message: "Sign in." });
  if (path === "/api/v1/auth/me") return send(200, admin);
  if (path === "/api/v1/me/provider-profile")
    return send(404, {
      code: "PROVIDER_PROFILE_REQUIRED",
      message: "No profile.",
    });
  if (path === "/api/v1/auth/logout") return send(204);
  if (path === "/api/v1/notifications") return send(200, []);
  if (path.startsWith("/api/v1/me/staff-security")) {
    if (!admin.roles.length)
      return send(403, {
        code: "STAFF_PERMISSION_REQUIRED",
        message: "Staff only.",
      });
    if (req.method === "GET")
      return send(200, {
        enabled,
        verified,
        expiresAt: verified
          ? new Date(Date.now() + 900000).toISOString()
          : null,
        recoveryCodesRemaining: 10,
      });
    if (path.endsWith("enrollment"))
      return send(201, {
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/Konet:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Konet",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });
    enabled = true;
    verified = true;
    return send(201, {
      verified: true,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      ...(path.endsWith("confirm")
        ? {
            recoveryCodes: Array.from(
              { length: 10 },
              (_, i) => `recovery-${i}-test-code`,
            ),
          }
        : {}),
    });
  }
  if (path.startsWith("/api/v1/admin/")) {
    if (!admin.roles.length)
      return send(403, {
        code: "STAFF_PERMISSION_REQUIRED",
        message: "Staff only.",
      });
    if (!verified)
      return send(403, {
        code: "STAFF_MFA_REQUIRED",
        message: "Verify your authenticator.",
      });
    const [, section, recordId, child] = path
      .replace("/api/v1/", "")
      .split("/");
    if (section === "reports")
      return send(200, {
        users: 2,
        providers: 1,
        jobs: 1,
        disputes: 1,
        collectedMinor: 100000,
        paidOutMinor: 0,
        refundedMinor: 0,
        earnedCommissionMinor: 0,
        reservedClientFundsMinor: 100000,
        knownProcessingFeesMinor: 1500,
        missingProcessingFeeCount: 0,
        currency: "NGN",
        asOf: new Date().toISOString(),
      });
    if (req.method !== "GET") {
      if (section === "users" && child === "status")
        Object.assign(target, { accountStatus: body.status });
      if (section === "reconciliations") {
        const run = {
          id: id(19),
          status: "queued",
          total: 1,
          checked: 0,
          skipped: 0,
          mismatchCount: 0,
          createdAt: new Date().toISOString(),
          ...body,
        };
        rows.reconciliations.push(run);
        return send(202, run);
      }
      return send(req.method === "DELETE" ? 204 : 200, { accepted: true });
    }
    if (child === "campuses") return send(200, university.campuses);
    if (child === "email-domains")
      return send(200, [{ id: id(20), domain: "test.edu", approved: true }]);
    return send(
      200,
      recordId
        ? ((rows[section] ?? []).find((row) => row.id === recordId) ?? {})
        : (rows[section] ?? []),
    );
  }
  return send(404, { code: "NOT_FOUND", message: path });
});
backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const apiPort = backend.address().port;
const available = http.createServer();
available.listen(0, "127.0.0.1");
await once(available, "listening");
const port = available.address().port;
await new Promise((resolve) => available.close(resolve));
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    String(port),
    "-H",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      KONET_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (data) => (output += data));
child.stderr.on("data", (data) => (output += data));
let browser, page;
const base = `http://127.0.0.1:${port}`;
try {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      await fetch(base + "/sign-in");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/admin");
  await expect(page).toHaveURL(/sign-in/);
  // Shared user-facing layouts must fit both desktop and mobile viewports.
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/sign-in", "/sign-up", "/forgot-password", "/how-it-works", "/for-providers", "/trust-and-safety"]) {
      await page.goto(base + route);
      await expect(page.locator(".wordmark:visible").first()).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflows at ${width}px`);
      if (route === "/sign-in" && [1440, 390].includes(width)) await page.screenshot({ path: `/tmp/konet-login-${width}.png`, fullPage: true });
      if (route === "/how-it-works" && width === 1440) {
        await expect(page.locator(".desktop-nav")).toBeVisible();
      const nav = await page.locator(".desktop-nav").evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x,width:r.width}; });
        await expect(page.locator(".header-actions")).toBeVisible();
      const actions = await page.locator(".header-actions").evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x,width:r.width}; });
        assert.ok(nav && actions && nav.x + nav.width <= actions.x, "Header navigation overlaps account actions");
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const login = await context.request.post(base + "/api/frontend", {
    headers: { Origin: base },
    data: {
      name: "signIn",
      input: { email: admin.email, password: "test-password" },
    },
  });
  assert.equal(login.status(), 200);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/discover");
    await expect(page.getByRole("heading", { name: "Find your next great collaborator." })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Discover overflows at ${width}px`);
    if (width === 1440) {
      await expect(page.locator(".desktop-nav")).toBeVisible();
      const nav = await page.locator(".desktop-nav").evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x,width:r.width}; });
      await expect(page.locator(".header-actions")).toBeVisible();
      const actions = await page.locator(".header-actions").evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x,width:r.width}; });
      assert.ok(nav && actions && nav.x + nav.width <= actions.x, "Signed-in header navigation overlaps account actions");
    }
    if ([1440,390].includes(width)) await page.screenshot({ path: `/tmp/konet-discover-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/admin");
  await expect(
    page.getByRole("heading", { name: "Verify staff access", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open staff security" }).click();
  await page.getByLabel("Current password").fill("test-password");
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add Konet to your authenticator" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Scan this QR code with your authenticator app"),
  ).toBeVisible();
  await page.getByLabel("Authenticator code", { exact: true }).fill("000123");
  await page
    .getByRole("button", { name: "Confirm authenticator", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Save your recovery codes now" }),
  ).toBeVisible();
  await expect(page.locator(".admin-codes code")).toHaveCount(10);
  await page
    .getByRole("button", { name: "I have saved my recovery codes" })
    .click();
  await page
    .getByRole("link", { name: "Accounts & staff", exact: true })
    .click();
  await expect(page.getByText(target.email, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open record" }).first().click();
  const status = page
    .locator(".admin-action")
    .filter({
      has: page.getByRole("heading", { name: "Change account status" }),
    });
  await status.locator("select[name=status]").selectOption("suspended");
  await status
    .getByLabel("Reason for this action")
    .fill("Investigating abuse reports");
  await status.getByRole("button", { name: "Review action" }).click();
  assert.equal(calls.filter((call) => call.path.endsWith("/status")).length, 0);
  await status
    .getByRole("button", { name: "Confirm: Change account status" })
    .click();
  await expect(
    page
      .getByText("Action completed. The latest records have been refreshed.")
      .first(),
  ).toBeVisible();
  assert.equal(target.accountStatus, "suspended");
  for (const [section, title] of [
    ["student-verifications", "Student verification"],
    ["provider-verifications", "Provider evidence"],
    ["providers", "Provider approvals"],
    ["disputes", "Disputes"],
    ["payments", "Payments & refunds"],
    ["payouts", "Provider payouts"],
    ["reconciliations", "Reconciliation"],
    ["universities", "Universities & campuses"],
    ["categories", "Service categories"],
    ["audit-events", "Audit trail"],
    ["reports", "Financial reports"],
  ]) {
    await page.goto(base + `/admin/${section}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Loading records|Loading report/)).toHaveCount(
      0,
    );
  }
  await page.goto(base + `/admin/universities/${university.id}`);
  await expect(
    page.getByRole("heading", { name: "Campuses", exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("test.edu", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/konet-admin-desktop.png",
    fullPage: true,
  });
  await page.goto(base + "/admin/reconciliations");
  await page
    .getByRole("button", { name: "Start reconciliation", exact: true })
    .click();
  await page.getByLabel("Start (inclusive)").fill("2026-10-01T00:00");
  await page.getByLabel("End (exclusive)").fill("2026-10-02T00:00");
  await page.getByRole("button", { name: "Review action" }).click();
  await page
    .getByRole("button", { name: "Confirm: Start reconciliation" })
    .click();
  await expect(page.getByRole("cell", { name: "queued", exact: true })).toBeVisible();
  assert.equal(
    calls.filter(
      (call) =>
        call.path === "/api/v1/admin/reconciliations" && call.method === "POST",
    ).length,
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/admin/categories");
  await expect(
    page.getByRole("heading", { name: "Service categories", exact: true }),
  ).toBeVisible();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile layout must not overflow the viewport",
  );
  await page.screenshot({
    path: "/tmp/konet-admin-mobile.png",
    fullPage: true,
  });
  admin.roles = [];
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Staff access required", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "Passed regular-page layout checks at four widths and admin browser checks: anonymous and role gates, MFA QR setup and recovery codes, confirmation before suspension, all admin sections, university subresources, reconciliation and mobile layout. Backend is a local test fixture; no external messages or money movement.",
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({
        path: "/tmp/konet-admin-browser-failure.png",
        fullPage: true,
      })
      .catch(() => {});
    console.error(
      await page
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  }
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
}

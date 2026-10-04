import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

// Runs against the HTTP integration fixture after its normal journeys populate
// records. No passwords are saved, and no production data is modified.
export async function reviewUserInterface({ base, cookies, routes }) {
  const browser = await chromium.launch({ headless: true });
  const directory = "/tmp/konet-user-ui";
  await fs.mkdir(directory, { recursive: true });
  const issues = [];
  const results = [];
  try {
    const context = await browser.newContext();
    await context.addCookies(
      [...cookies].map(([name, value]) => ({
        name,
        value,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      })),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      issues.push({
        route: new URL(page.url()).pathname,
        error: error.message,
      }),
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(base + route, { waitUntil: "load" });
        await page.waitForFunction(
          () =>
            ![...document.querySelectorAll('[role="status"]')].some((element) =>
              /^Loading/i.test(element.textContent?.trim() ?? ""),
            ),
          undefined,
          { timeout: 15000 },
        );
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate(() => ({
          path: location.pathname,
          overflow: document.documentElement.scrollWidth > innerWidth,
          heading: document.querySelector("h1")?.textContent,
          title: document.title,
          alerts: [...document.querySelectorAll('[role="alert"]')].map(
            (element) => element.textContent,
          ),
        }));
        const screenshot = `${directory}/${route.replaceAll("/", "_").replaceAll("?", "_")}-${width}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        results.push({ route, width, ...result, screenshot });
        if (
          result.overflow ||
          result.alerts.length ||
          result.title.includes("404")
        )
          issues.push({ route, width, ...result });
      }
      await page.goto(base + "/jobs");
      await expect(
        page.locator('.mobile-nav a[aria-current="page"]'),
      ).toHaveAttribute("href", "/jobs");
      if (width === 390) {
        await page.locator(".header-menu summary").click();
        await expect(
          page
            .getByRole("navigation", { name: "More navigation" })
            .getByRole("link", { name: "Account settings" }),
        ).toBeVisible();
        await page
          .getByRole("navigation", { name: "More navigation" })
          .getByRole("link", { name: "Account settings" })
          .click();
        await expect(page).toHaveURL(/\/settings$/);
        await expect(page.locator(".header-menu")).not.toHaveAttribute(
          "open",
          "",
        );
      }
    }
    await fs.writeFile(
      `${directory}/report.json`,
      JSON.stringify({ results, issues }, null, 2),
    );
    const escape = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll('"', "&quot;");
    await fs.writeFile(
      `${directory}/index.html`,
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Konet user UI review</title><style>body{margin:0;padding:32px;background:#f7f5ef;color:#25231e;font:14px system-ui}h1{font-size:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}article{background:white;border:1px solid #ddd5c9;padding:16px;border-radius:12px}img{width:100%;height:300px;object-fit:cover;object-position:top;border:1px solid #eee}a{color:#b8502d}p{overflow-wrap:anywhere}</style><h1>Konet user UI review</h1><p>Click a screenshot to inspect the full page. Populated records are isolated test fixtures.</p><main>${results
        .map((result) => {
          const file = result.screenshot.split("/").at(-1);
          return `<article><p><strong>${escape(result.route)}</strong> · ${result.width}px</p><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt="${escape(result.route)} at ${result.width}px"></a></article>`;
        })
        .join("")}</main></html>`,
    );
    assert.deepEqual(
      issues,
      [],
      "User UI browser review found errors; see /tmp/konet-user-ui/report.json",
    );
    console.log(
      `Reviewed ${results.length} populated user-page views, including mobile menu interaction. Screenshots: ${directory}`,
    );
  } finally {
    await browser.close();
  }
}

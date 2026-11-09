import { expect, test } from "@playwright/test";

test("production build: secure cookie, security headers, CSP-clean load, realtime", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));

  const res = await page.goto("/");
  const headers = res?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");

  await page.getByLabel("Your name").fill("Prod Phantom");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");

  // Production session cookie: __Host- prefix, Secure, HttpOnly, SameSite=Lax, path /.
  const cookies = await context.cookies();
  const sid = cookies.find((c) => c.name === "__Host-ghostel_sid");
  expect(sid).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax", path: "/" });
  expect(cookies.some((c) => c.name === "ghostel_sid")).toBe(false);
  // The token is not readable from JavaScript.
  expect(await page.evaluate(() => document.cookie)).not.toContain("ghostel_sid");

  await page.reload();
  await expect(page.getByTestId("nametag-self")).toHaveText("Prod Phantom");

  // Static asset caching: hashed assets are immutable, the HTML is not cached.
  const html = await page.request.get("/");
  expect(html.headers()["cache-control"]).toBe("no-cache");
  const asset = await page.evaluate(() => (document.querySelector("script[type=module]") as HTMLScriptElement).src);
  expect((await page.request.get(asset)).headers()["cache-control"]).toContain("immutable");

  // Unknown routes fall back to the app; unknown API routes are JSON 404s.
  expect((await page.request.get("/some/deep/link")).status()).toBe(200);
  expect((await page.request.get("/api/nope")).status()).toBe(404);

  await page.waitForTimeout(1500);
  expect(problems).toEqual([]);
  await context.close();
});

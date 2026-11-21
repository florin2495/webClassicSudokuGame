import { expect, test } from "@playwright/test";
import { BASE, emptyCells, expectValue, KEY_GAME, openPuzzle, solutionAt, write } from "./helpers";

// Desktop Chromium only: service worker, offline start, the update button, keyboard play.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "desktop-only checks");
});

test("installable: manifest with its own id and scope, icons, service worker script", async ({ request }) => {
  const res = await request.get(`${BASE}/manifest.webmanifest`);
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({ id: "/classicsudoku/", start_url: "/classicsudoku", scope: "/classicsudoku", display: "standalone" });
  expect(m.icons).toHaveLength(3);
  for (const icon of m.icons as { src: string }[]) {
    const r = await request.get(new URL(icon.src, BASE).toString());
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  const sw = await request.get(`${BASE}/sw.js`);
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(sw.headers()["service-worker-allowed"]).toBe("/classicsudoku");
  expect(await sw.text()).toContain("SKIP_WAITING");
});

test("works offline once it has been opened, with the same game", async ({ page, context }, info) => {
  const pz = await openPuzzle(page, "classic", "medium", 61);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/classicsudoku");
  // Second load under the worker's control caches every asset the page uses.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  const saved = await page.evaluate((k) => localStorage.getItem(k), KEY_GAME);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY_GAME)).toBe(saved);
  // It still plays.
  const p = emptyCells(pz)[0];
  await write(page, info, p, solutionAt(pz, p));
  await expectValue(page, p, solutionAt(pz, p));
  await context.setOffline(false);
});

test("shows a separate reload button when a newer version is live, and reloading keeps the game", async ({ page }, info) => {
  await page.route("**/classicsudoku/api/version", (route) => route.fulfill({ json: { version: "999.0.0" } }));
  const pz = await openPuzzle(page, "classic", "easy", 77);
  const p = emptyCells(pz)[0];
  await write(page, info, p, solutionAt(pz, p));

  const button = page.getByTestId("update-reload");
  await expect(button).toBeVisible();
  await expect(button).toContainText("v999.0.0");
  await Promise.all([page.waitForEvent("load"), button.click()]);
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  await expectValue(page, p, solutionAt(pz, p));
});

test("keyboard: arrows, digits, backspace, N for notes, Ctrl+Z", async ({ page }) => {
  const pz = await openPuzzle(page, "classic", "easy", 88);
  const p = emptyCells(pz)[0];
  await page.locator(`[data-cell="${p}"]`).click();
  await page.keyboard.press(String(solutionAt(pz, p)));
  await expectValue(page, p, solutionAt(pz, p));
  await page.keyboard.press("Backspace");
  await expectValue(page, p, 0);
  await page.keyboard.press("Control+z");
  await expectValue(page, p, solutionAt(pz, p));
  await page.keyboard.press("Backspace");
  await page.keyboard.press("n");
  await page.keyboard.press("3");
  await expect(page.locator(`[data-cell="${p}"]`)).toHaveAttribute("data-notes", "4");
  // Arrow keys move the selection: the next digit goes one cell to the right (or stays if it is a given).
  await page.keyboard.press("n");
  const right = p % 9 < 8 ? p + 1 : p - 1;
  await page.keyboard.press(p % 9 < 8 ? "ArrowRight" : "ArrowLeft");
  if (pz.givens[right] === "0") {
    await page.keyboard.press(String(solutionAt(pz, right)));
    await expectValue(page, right, solutionAt(pz, right));
  }
});

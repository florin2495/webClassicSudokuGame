import { expect, test } from "@playwright/test";
import { geometry } from "../../src/lib/geometry";
import { BASE, cell, emptyCells, expectValue, hit, KEY_GAME, openPuzzle, solutionAt, uiValues, write } from "./helpers";

test("first visit: pick the type and the level, then the puzzle appears", async ({ page }, info) => {
  await page.goto(BASE);
  const dialog = page.getByTestId("newgame-dialog");
  await expect(dialog).toBeVisible();
  await hit(page.getByTestId("variant-tree"), info);
  await hit(page.getByTestId("level-medium"), info);
  await expect(page.getByTestId("variant-tree")).toHaveAttribute("aria-pressed", "true");
  await hit(page.getByTestId("start-game"), info);
  await expect(page.locator("[data-cell]")).toHaveCount(81, { timeout: 60_000 });
  await expect(page.getByTestId("grid")).toHaveAttribute("data-variant", "tree");
  await expect(page.locator("[data-shade]")).toHaveCount(27);
  await expect(page.getByTestId("game-label")).toHaveText("Brad · Mediu");
  await expect(dialog).toHaveCount(0);
});

test("a classic easy sudoku played to the end with the pad: win wave, result, stats, no replay after reload", async ({ page }, info) => {
  const pz = await openPuzzle(page, "classic", "easy", 4242);
  const before = await uiValues(page);
  for (const p of geometry("classic").cells) expect(before[p]).toBe(Number(pz.givens[p]));

  const empties = emptyCells(pz);
  for (const p of empties) await write(page, info, p, solutionAt(pz, p));
  await expect(page.getByTestId("win-wave")).toHaveCount(1);
  const result = page.getByTestId("win-dialog");
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("win-hints")).toHaveText("0");

  // Reload: the result again, without the animation.
  await page.reload();
  await expect(result).toBeVisible();
  await expect(page.getByTestId("win-wave")).toHaveCount(0);

  // "Încă unul la fel": a new classic easy puzzle.
  const solved = JSON.stringify(await uiValues(page));
  await hit(page.getByTestId("win-new-game"), info);
  await expect.poll(async () => JSON.stringify(await uiValues(page)), { timeout: 60_000 }).not.toBe(solved);
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  await expect(page.getByTestId("game-label")).toHaveText("Clasic · Ușor");
  await hit(page.getByTestId("menu-open"), info);
  await expect(page.getByTestId("stat-classic-easy")).toContainText("1/1");
});

test("notes, erase, undo, clashes in red", async ({ page }, info) => {
  const pz = await openPuzzle(page, "classic", "medium", 77);
  const geo = geometry("classic");
  const p = emptyCells(pz)[0];
  // Notes 1 and 2 in an empty cell.
  await hit(cell(page, p), info);
  await hit(page.getByTestId("notes"), info);
  await expect(page.getByTestId("notes")).toHaveAttribute("aria-pressed", "true");
  await hit(page.getByTestId("digit-1"), info);
  await hit(page.getByTestId("digit-2"), info);
  await expect(cell(page, p)).toHaveAttribute("data-notes", "3");
  await hit(page.getByTestId("notes"), info);

  // A digit that a given peer already has: red.
  const peerGiven = geo.peers[p].find((q) => pz.givens[q] !== "0")!;
  const clash = Number(pz.givens[peerGiven]);
  await hit(page.getByTestId(`digit-${clash}`), info);
  await expectValue(page, p, clash);
  await expect(cell(page, p).locator("text")).toHaveAttribute("fill", "#dc2626");

  // Undo brings the notes back; erase clears them.
  await hit(page.getByTestId("undo"), info);
  await expectValue(page, p, 0);
  await expect(cell(page, p)).toHaveAttribute("data-notes", "3");
  await hit(page.getByTestId("erase"), info);
  await expect(cell(page, p)).not.toHaveAttribute("data-notes", /.+/);

  // The right digit is blue; a given cannot change.
  await hit(page.getByTestId(`digit-${solutionAt(pz, p)}`), info);
  await expect(cell(page, p).locator("text")).toHaveAttribute("fill", "#1d4ed8");
  await hit(cell(page, peerGiven), info);
  await hit(page.getByTestId(`digit-${(clash % 9) + 1}`), info);
  await expectValue(page, peerGiven, clash);
  await expect(page.getByTestId("toast")).toContainText("nu se pot schimba");
});

test("hint: points at a wrong digit first, then fills a cell", async ({ page }, info) => {
  const pz = await openPuzzle(page, "tree", "easy", 5);
  const [a, b] = emptyCells(pz);
  const wrong = (solutionAt(pz, a) % 9) + 1;
  await write(page, info, a, wrong);
  await hit(page.getByTestId("hint"), info);
  await expect(page.getByTestId("toast")).toContainText("greșită");
  await expectValue(page, a, wrong);
  await hit(page.getByTestId("erase"), info);
  await hit(cell(page, b), info);
  await hit(page.getByTestId("hint"), info);
  await expectValue(page, b, solutionAt(pz, b));
  await expect(cell(page, b).locator("text")).toHaveAttribute("fill", "#7e22ce");
});

test("reload keeps the game, digits and notes", async ({ page }, info) => {
  const pz = await openPuzzle(page, "classic", "hard", 9);
  const [a, b] = emptyCells(pz);
  await write(page, info, a, solutionAt(pz, a));
  await hit(cell(page, b), info);
  await hit(page.getByTestId("notes"), info);
  await hit(page.getByTestId("digit-5"), info);
  const saved = await page.evaluate((k) => localStorage.getItem(k), KEY_GAME);
  expect(saved).toContain(pz.givens);
  await page.reload();
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  await expectValue(page, a, solutionAt(pz, a));
  await expect(cell(page, b)).toHaveAttribute("data-notes", "16");
  await expect(page.getByTestId("game-label")).toHaveText("Clasic · Greu");
});

test("samurai: 369 cells, a digit in a shared box counts for both grids", async ({ page }, info) => {
  const pz = await openPuzzle(page, "samurai", "easy", 21);
  const geo = geometry("samurai");
  await expect(page.getByTestId("grid")).toHaveAttribute("data-variant", "samurai");
  const shared = emptyCells(pz).find((p) => geo.unitsOf[p].length === 5)!;
  await write(page, info, shared, solutionAt(pz, shared));
  await expectValue(page, shared, solutionAt(pz, shared));
  // The same digit somewhere it clashes in the middle grid only (same row of the middle grid, outside the corner grid).
  const r = Math.floor(shared / 21);
  const inMiddleOnly = Array.from({ length: 9 }, (_, j) => r * 21 + 6 + j).find(
    (q) => q % 21 >= 9 && pz.givens[q] === "0",
  );
  if (inMiddleOnly !== undefined) {
    await write(page, info, inMiddleOnly, solutionAt(pz, shared));
    await expect(cell(page, inMiddleOnly).locator("text")).toHaveAttribute("fill", "#dc2626");
  }
});

test("menu: mistakes shown at once, stats, version", async ({ page }, info) => {
  const pz = await openPuzzle(page, "classic", "easy", 31);
  const geo = geometry("classic");
  // A wrong digit that clashes with nothing.
  let target = -1;
  let digit = 0;
  for (const p of emptyCells(pz)) {
    const used = new Set(geo.peers[p].map((q) => Number(pz.givens[q])));
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => x !== solutionAt(pz, p) && !used.has(x));
    if (d) {
      target = p;
      digit = d;
      break;
    }
  }
  expect(target).toBeGreaterThanOrEqual(0);
  await write(page, info, target, digit);
  await expect(cell(page, target).locator("text")).toHaveAttribute("fill", "#1d4ed8");

  await hit(page.getByTestId("menu-open"), info);
  const menu = page.getByTestId("menu");
  await expect(menu).toBeVisible();
  await hit(menu.getByTestId("setting-mistakes").getByRole("button", { name: "Imediat" }), info);
  await expect(menu.getByTestId("stat-classic-easy")).toContainText("0/1");
  await expect(menu.getByTestId("app-version")).toContainText("Versiunea");
  await hit(menu.getByRole("button", { name: "Închide" }), info);
  await expect(cell(page, target).locator("text")).toHaveAttribute("fill", "#dc2626");
});

test("new game while one is in progress warns before replacing it", async ({ page }, info) => {
  const pz = await openPuzzle(page, "classic", "easy", 55);
  const p = emptyCells(pz)[0];
  await write(page, info, p, solutionAt(pz, p));
  await hit(page.getByTestId("new-game"), info);
  await expect(page.getByTestId("newgame-warning")).toBeVisible();
  await hit(page.getByRole("button", { name: "Închide" }), info);
  await expectValue(page, p, solutionAt(pz, p));
});

import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { generate, type Level, type Puzzle } from "../../src/lib/generate";
import { geometry, type Variant } from "../../src/lib/geometry";

export const BASE = (process.env.E2E_BASE_URL ?? "https://games.hailatat.icu/classicsudoku").replace(/\/+$/, "");
export const KEY_GAME = "sudoku:game:v1";

export const isPhone = (info: TestInfo) => info.project.name === "android-chromium";

/** Tap on the phone, click on the desktop. */
export async function hit(l: Locator, info: TestInfo) {
  if (isPhone(info)) await l.tap();
  else await l.click();
}

export const cell = (page: Page, p: number) => page.locator(`[data-cell="${p}"]`);

/** Open a fixed puzzle (fresh browser context = empty storage) and wait until it is on the board. */
export async function openPuzzle(page: Page, variant: Variant, level: Level, seed: number): Promise<Puzzle> {
  await page.goto(`${BASE}?seed=${seed}&type=${variant}&level=${level}`);
  await expect(page.locator("[data-cell]")).toHaveCount(geometry(variant).cells.length, { timeout: 60_000 });
  return generate(variant, level, seed);
}

/** Digit of every cell as the page shows it. */
export async function uiValues(page: Page): Promise<Record<number, number>> {
  const rows = await page
    .locator("[data-cell]")
    .evaluateAll((els) => els.map((e) => [Number(e.getAttribute("data-cell")), Number(e.getAttribute("data-value"))] as const));
  return Object.fromEntries(rows);
}

export async function expectValue(page: Page, p: number, d: number) {
  await expect(cell(page, p)).toHaveAttribute("data-value", String(d));
}

/** Empty cells of a puzzle, in reading order. */
export const emptyCells = (pz: Puzzle) => geometry(pz.variant).cells.filter((p) => pz.givens[p] === "0");
export const solutionAt = (pz: Puzzle, p: number) => Number(pz.solution[p]);

/** Select a cell and write a digit with the on-screen pad. */
export async function write(page: Page, info: TestInfo, p: number, d: number) {
  await hit(cell(page, p), info);
  await hit(page.getByTestId(`digit-${d}`), info);
}

/** No horizontal scroll of the page itself. */
export async function expectNoHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

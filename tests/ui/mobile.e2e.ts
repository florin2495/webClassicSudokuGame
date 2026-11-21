import { expect, test, type Page } from "@playwright/test";
import { cell, emptyCells, expectNoHorizontalScroll, expectValue, openPuzzle, solutionAt } from "./helpers";

// Android phone (Pixel 7, touch) only: the game must fit the screen and be big enough for a finger.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "android-chromium", "phone-only checks");
});

async function boxes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
}

test("classic fits the phone screen, big cells and buttons", async ({ page }) => {
  const pz = await openPuzzle(page, "classic", "easy", 4242);
  await expectNoHorizontalScroll(page);
  const vp = page.viewportSize()!;
  for (const b of await boxes(page, "[data-cell]")) {
    expect(b.width).toBeGreaterThanOrEqual(38);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(vp.width + 0.5);
    expect(b.bottom).toBeLessThanOrEqual(vp.height + 0.5);
  }
  for (const id of ["new-game", "undo", "hint", "menu-open", "notes", "erase", "digit-1", "digit-9"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(44);
    expect(b.width, id).toBeGreaterThanOrEqual(36);
    expect(b.y + b.height, id).toBeLessThanOrEqual(vp.height + 0.5);
  }
  const p = emptyCells(pz)[0];
  await cell(page, p).tap();
  await page.getByTestId(`digit-${solutionAt(pz, p)}`).tap();
  await expectValue(page, p, solutionAt(pz, p));
});

test("samurai: the whole board fits, a tap zooms in to finger-sized cells, the button zooms out", async ({ page }) => {
  const pz = await openPuzzle(page, "samurai", "medium", 12);
  await expectNoHorizontalScroll(page);
  const vp = page.viewportSize()!;
  const grid = (await page.getByTestId("grid").boundingBox())!;
  expect(grid.x).toBeGreaterThanOrEqual(0);
  expect(grid.x + grid.width).toBeLessThanOrEqual(vp.width + 0.5);

  const p = emptyCells(pz).find((q) => q % 21 > 12 && Math.floor(q / 21) > 12)!; // bottom-right grid
  await cell(page, p).tap();
  await expect(page.getByTestId("zoom")).toHaveAttribute("aria-pressed", "true");
  const zoomed = (await cell(page, p).boundingBox())!;
  expect(zoomed.width).toBeGreaterThanOrEqual(40);
  // The zoomed cell is on screen, the page itself still does not scroll sideways.
  expect(zoomed.x).toBeGreaterThanOrEqual(0);
  expect(zoomed.x + zoomed.width).toBeLessThanOrEqual(vp.width + 0.5);
  await expectNoHorizontalScroll(page);
  await page.getByTestId(`digit-${solutionAt(pz, p)}`).tap();
  await expectValue(page, p, solutionAt(pz, p));

  await page.getByTestId("zoom").tap();
  await expect(page.getByTestId("zoom")).toHaveAttribute("aria-pressed", "false");
  const all = (await page.getByTestId("grid").boundingBox())!;
  expect(all.width).toBeLessThanOrEqual(vp.width + 0.5);
});

test("landscape still shows the whole grid and the pad inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await openPuzzle(page, "tree", "easy", 3);
  await expectNoHorizontalScroll(page);
  for (const sel of ["[data-cell]", '[data-testid^="digit-"]']) {
    for (const b of await boxes(page, sel)) {
      expect(b.right).toBeLessThanOrEqual(915.5);
      expect(b.bottom).toBeLessThanOrEqual(412.5);
      expect(b.top).toBeGreaterThanOrEqual(0);
    }
  }
});

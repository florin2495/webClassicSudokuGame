import { describe, expect, it } from "vitest";
import { generate, generateSteps, LEVELS, MIN_GIVEN_SHARE, mirrorPairs, type Puzzle } from "./generate";
import { geometry, VARIANTS } from "./geometry";
import { solvableAt } from "./logic";
import { hasUniqueSolution, solve } from "./solver";
import { gridOf, isValidSolution } from "./test-utils";

const givensCount = (p: Puzzle) => [...p.givens].filter((ch) => ch !== "0").length;

describe("generator", () => {
  for (const variant of VARIANTS) {
    for (const level of LEVELS) {
      it(`${variant} ${level}: one solution, the right level, enough givens`, () => {
        const t0 = Date.now();
        const p = generate(variant, level, 2024);
        const ms = Date.now() - t0;
        const g = geometry(variant);
        const n = givensCount(p);
        console.log(`${variant} ${level}: ${n}/${g.cells.length} givens, ${ms} ms`);

        expect(p.givens).toHaveLength(g.size);
        expect(p.solution).toHaveLength(g.size);
        const solution = gridOf(p.solution);
        expect(isValidSolution(g, solution)).toBe(true);
        for (let i = 0; i < g.size; i++) {
          if (!g.active[i]) {
            expect(p.givens[i]).toBe("0");
            expect(p.solution[i]).toBe("0");
          } else if (p.givens[i] !== "0") expect(p.givens[i]).toBe(p.solution[i]);
        }
        expect(n).toBeGreaterThanOrEqual(Math.ceil(g.cells.length * MIN_GIVEN_SHARE[level]));
        expect(n).toBeLessThan(g.cells.length * 0.75);

        const grid = gridOf(p.givens);
        const r = solve(g, grid, { limit: 2, maxNodes: 2_000_000 });
        expect(r.aborted).toBe(false);
        expect(r.solutions).toHaveLength(1);
        expect(Array.from(r.solutions[0]).join("")).toBe(p.solution);
        if (level === "easy") expect(solvableAt(g, grid, 1)).toBe(true);
        if (level === "medium") expect(solvableAt(g, grid, 2)).toBe(true);
        if (level === "hard") console.log(`${variant} hard needs more than singles: ${!solvableAt(g, grid, 1)}`);
        // Generation must stay quick enough for a phone (CI machines are not slower than a phone by more than ~3×).
        expect(ms).toBeLessThan(variant === "samurai" ? 20_000 : 5_000);
      }, 120_000);
    }
  }

  it("is deterministic and yields progress between removals", () => {
    const a = generate("classic", "medium", 99);
    const b = generate("classic", "medium", 99);
    expect(b).toEqual(a);
    expect(generate("classic", "medium", 100).givens).not.toBe(a.givens);
    const iter = generateSteps("tree", "easy", 7);
    let steps = 0;
    let last = 0;
    for (let r = iter.next(); !r.done; r = iter.next()) {
      expect(r.value).toBeGreaterThanOrEqual(last);
      expect(r.value).toBeLessThan(1);
      last = r.value;
      steps++;
    }
    expect(steps).toBeGreaterThan(10);
  });

  it("harder levels give fewer givens (classic, average of 5 seeds)", () => {
    const avg = (level: (typeof LEVELS)[number]) =>
      [1, 2, 3, 4, 5].reduce((s, seed) => s + givensCount(generate("classic", level, seed)), 0) / 5;
    const easy = avg("easy");
    const medium = avg("medium");
    const hard = avg("hard");
    console.log(`classic average givens: easy ${easy}, medium ${medium}, hard ${hard}`);
    expect(easy).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(hard);
  }, 120_000);

  it("hard classic puzzles usually need more than singles", () => {
    const g = geometry("classic");
    const beyond = [1, 2, 3, 4, 5, 6].filter((seed) => !solvableAt(g, gridOf(generate("classic", "hard", seed).givens), 1)).length;
    console.log(`hard classic needing more than singles: ${beyond}/6`);
    expect(beyond).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it("removes cells in mirror pairs (180°), so the givens are symmetric for easy and medium", () => {
    for (const v of VARIANTS) {
      const g = geometry(v);
      const pairs = mirrorPairs(g);
      expect(pairs.flat().sort((a, b) => a - b)).toEqual(g.cells);
      const p = generate(v, "easy", 3);
      for (const pair of pairs) {
        if (pair.length === 2) expect(p.givens[pair[0]] === "0").toBe(p.givens[pair[1]] === "0");
      }
    }
  }, 120_000);

  it("every generated puzzle is unique (several seeds, classic and tree)", () => {
    for (const v of ["classic", "tree"] as const) {
      for (const seed of [31, 32, 33]) {
        const g = geometry(v);
        expect(hasUniqueSolution(g, gridOf(generate(v, "hard", seed).givens), 2_000_000)).toBe(true);
      }
    }
  }, 120_000);
});

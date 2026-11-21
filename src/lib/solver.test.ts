import { describe, expect, it } from "vitest";
import { mulberry32 } from "./generate";
import { geometry, VARIANTS } from "./geometry";
import { solvableAt } from "./logic";
import { DIGIT, digitsOf, hasUniqueSolution, POP, randomSolution, solve } from "./solver";
import { gridOf, HARD_PUZZLE, isValidSolution, WIKI_PUZZLE, WIKI_SOLUTION } from "./test-utils";

const classic = geometry("classic");

describe("bit helpers", () => {
  it("counts and names digits", () => {
    expect(POP[0]).toBe(0);
    expect(POP[0x1ff]).toBe(9);
    expect(DIGIT[1]).toBe(1);
    expect(DIGIT[1 << 8]).toBe(9);
    expect(DIGIT[3]).toBe(0);
    expect(digitsOf(0b100000101)).toEqual([1, 3, 9]);
  });
});

describe("solver", () => {
  it("solves a classic puzzle to its known solution, and it is the only one", () => {
    const r = solve(classic, gridOf(WIKI_PUZZLE));
    expect(r.aborted).toBe(false);
    expect(r.solutions).toHaveLength(1);
    expect(Array.from(r.solutions[0]).join("")).toBe(WIKI_SOLUTION);
    expect(hasUniqueSolution(classic, gridOf(WIKI_PUZZLE))).toBe(true);
  });

  it("finds a second solution when there is one, and none when the givens clash", () => {
    const sparse = gridOf(WIKI_PUZZLE).map((d, i) => (i < 40 ? 0 : d));
    expect(solve(classic, sparse).solutions).toHaveLength(2);
    expect(hasUniqueSolution(classic, sparse)).toBe(false);
    const clash = gridOf(WIKI_PUZZLE);
    clash[2] = 5; // a second 5 in row 0
    expect(solve(classic, clash).solutions).toHaveLength(0);
  });

  it("solves a very hard puzzle by search", () => {
    const grid = gridOf(HARD_PUZZLE);
    const r = solve(classic, grid);
    expect(r.solutions).toHaveLength(1);
    const s = r.solutions[0];
    expect(isValidSolution(classic, s)).toBe(true);
    grid.forEach((d, i) => d && expect(s[i]).toBe(d));
  });

  it("fills a random valid grid for every variant, the same for the same seed", () => {
    for (const v of VARIANTS) {
      const g = geometry(v);
      const a = randomSolution(g, mulberry32(11));
      expect(isValidSolution(g, a), v).toBe(true);
      expect(Array.from(randomSolution(g, mulberry32(11)))).toEqual(Array.from(a));
      expect(Array.from(randomSolution(g, mulberry32(12)))).not.toEqual(Array.from(a));
    }
  });

  it("a shared Samurai box holds the same digits for both grids", () => {
    const g = geometry("samurai");
    const s = randomSolution(g, mulberry32(5));
    // Top-left grid (rows/cols 0-8) and middle grid (rows/cols 6-14) both valid on their own.
    for (const [r0, c0] of [[0, 0], [0, 12], [6, 6], [12, 0], [12, 12]]) {
      for (let i = 0; i < 9; i++) {
        expect(new Set(Array.from({ length: 9 }, (_, j) => s[(r0 + i) * 21 + c0 + j])).size).toBe(9);
        expect(new Set(Array.from({ length: 9 }, (_, j) => s[(r0 + j) * 21 + c0 + i])).size).toBe(9);
      }
    }
  });
});

describe("logic solver", () => {
  it("easy puzzles fall to singles", () => {
    expect(solvableAt(classic, gridOf(WIKI_PUZZLE), 1)).toBe(true);
    expect(solvableAt(classic, gridOf(WIKI_PUZZLE), 2)).toBe(true);
  });

  it("does not crack a very hard puzzle and never guesses", () => {
    expect(solvableAt(classic, gridOf(HARD_PUZZLE), 1)).toBe(false);
    expect(solvableAt(classic, gridOf(HARD_PUZZLE), 2)).toBe(false);
  });

  it("does not solve a puzzle with two solutions", () => {
    const sparse = gridOf(WIKI_PUZZLE).map((d, i) => (i < 40 ? 0 : d));
    expect(solvableAt(classic, sparse, 2)).toBe(false);
  });
});

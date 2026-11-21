// Helpers shared by the unit tests (not used by the app).
import type { Geometry } from "./geometry";

export const gridOf = (s: string) => Array.from(s, (ch) => Number(ch));

/** Every unit holds 1..9 exactly once. */
export function isValidSolution(g: Geometry, grid: ArrayLike<number>): boolean {
  return g.units.every((u) => {
    const seen = new Set(u.map((p) => grid[p]));
    return seen.size === 9 && [...seen].every((d) => d >= 1 && d <= 9);
  });
}

/** Wikipedia's example puzzle and its solution. */
export const WIKI_PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
export const WIKI_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
/** A famously hard puzzle (A. Inkala, 2012): unique, but far beyond singles, pairs and locked candidates. */
export const HARD_PUZZLE = "800000000003600000070090200050007000000045700000100030001000068008500010090000400";

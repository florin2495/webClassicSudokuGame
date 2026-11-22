// Puzzle generator. Pure and deterministic (same variant, level and seed = same puzzle), unit-tested.
// 1. A random full grid (src/lib/solver.ts).
// 2. Digits are taken out in pairs that mirror each other through the centre (180°, the classic look), in random
//    order. A removal stays only if the puzzle is still fine for the level:
//    - easy:   solvable with singles only, and at least 47% of the cells stay given;
//    - medium: solvable with singles, locked candidates and naked pairs/triples, first down to 39% given;
//    - hard:   exactly one solution (proven by search), down to 29% given, then single cells too.
//    Logic-solvable means unique, so every level has exactly one solution.
// 3. Medium must also NEED more than singles. If it still falls to singles at 39%, every further removal (mirror
//    pairs first, then single cells) is tried, and the first one that keeps it solvable with level-2 logic but not
//    with singles ends it. If none does, one removal that keeps level 2 is made and the search goes on, down to 32%
//    given. The tries per grid are capped (about 48 000 / cells, so ~600 on a 9×9 and ~130 on a Samurai).
// 4. Medium and hard: if the result still falls to singles alone, try again with a new grid (up to 6 grids; each
//    takes well under 100 ms, even for a Samurai). The last try is kept if none needs more.
// `generateSteps` yields between removals (and between medium's extra tries) so the page can run it in slices
// without freezing.
import { geometry, type Geometry, type Variant } from "./geometry";
import { solvableAt } from "./logic";
import { hasUniqueSolution, randomSolution } from "./solver";

export type Level = "easy" | "medium" | "hard";
export const LEVELS: readonly Level[] = ["easy", "medium", "hard"];
export const LEVEL_NAMES: Record<Level, string> = { easy: "Ușor", medium: "Mediu", hard: "Greu" };

export function isLevel(x: unknown): x is Level {
  return x === "easy" || x === "medium" || x === "hard";
}

/** Share of the cells that stay given, at least (medium: only while it already needs more than singles). */
export const MIN_GIVEN_SHARE: Record<Level, number> = { easy: 0.47, medium: 0.39, hard: 0.29 };
/** Medium: how far it may go when it still falls to singles at MIN_GIVEN_SHARE.medium. */
export const MEDIUM_DEEP_SHARE = 0.32;
/** Medium: tries after the 39% floor, per grid, times the cell count (each try is one or two logic solves). */
const MEDIUM_DEEP_WORK = 48_000;
/** Grids tried until a medium or hard puzzle needs more than singles. */
const ATTEMPTS: Record<Level, number> = { easy: 1, medium: 6, hard: 6 };

export interface Puzzle {
  variant: Variant;
  level: Level;
  seed: number;
  /** One character per position: "1".."9" given, "0" empty or not part of the board. */
  givens: string;
  /** The full solution, same format ("0" only outside the board). */
  solution: string;
}

/** Small fast PRNG, the same in every browser and in Node. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => 1 + Math.floor(Math.random() * 2_000_000_000);

function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cell groups that are taken out together: each cell with its mirror through the centre. */
export function mirrorPairs(g: Geometry): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const p of g.cells) {
    if (seen.has(p)) continue;
    const r = Math.floor(p / g.width);
    const c = p % g.width;
    const q = (g.height - 1 - r) * g.width + (g.width - 1 - c);
    seen.add(p);
    seen.add(q);
    out.push(p === q ? [p] : [p, q]);
  }
  return out;
}

const toText = (grid: ArrayLike<number>) => Array.from(grid, (d) => String(d)).join("");

/** Is the grid still a good puzzle for the level? (Checked after every removal.) */
export function fitsLevel(g: Geometry, grid: ArrayLike<number>, level: Level): boolean {
  if (level === "easy") return solvableAt(g, grid, 1);
  if (level === "medium") return solvableAt(g, grid, 2);
  return hasUniqueSolution(g, grid);
}

/** Medium and hard must need more than singles; easy needs nothing more. */
export const hardEnough = (g: Geometry, grid: ArrayLike<number>, level: Level) => level === "easy" || !solvableAt(g, grid, 1);

/** Yields the progress (0..1) between removals; returns the puzzle. */
export function* generateSteps(variant: Variant, level: Level, seed: number): Generator<number, Puzzle, void> {
  const g = geometry(variant);
  const rng = mulberry32(seed);
  const minGivens = Math.ceil(g.cells.length * MIN_GIVEN_SHARE[level]);
  const deepMin = Math.ceil(g.cells.length * MEDIUM_DEEP_SHARE);
  // Samurai medium keeps the plain 39% pass: the extra search never got through its 369 cells in budget (user's choice,
  // 2026-11-22); it may fall to singles.
  const deepMedium = level === "medium" && variant !== "samurai";
  const deepTries = deepMedium ? Math.ceil(MEDIUM_DEEP_WORK / g.cells.length) : 0;
  const attempts = level === "medium" && !deepMedium ? 1 : ATTEMPTS[level];
  const perAttempt = mirrorPairs(g).length + (level === "hard" ? g.cells.length : 0) + deepTries;
  const total = perAttempt * attempts;
  let done = 0;
  let puzzle: Puzzle | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    done = Math.max(done, attempt * perAttempt);
    const solution = randomSolution(g, rng);
    const grid = solution.slice();
    let givens = g.cells.length;
    const passes: number[][][] = [shuffle(mirrorPairs(g), rng)];
    if (level === "hard") passes.push(shuffle(g.cells.map((p) => [p]), rng));

    for (const pass of passes) {
      for (const group of pass) {
        done++;
        if (group.some((p) => grid[p] === 0) || givens - group.length < minGivens) continue;
        const kept = group.map((p) => grid[p]);
        for (const p of group) grid[p] = 0;
        if (fitsLevel(g, grid, level)) givens -= group.length;
        else group.forEach((p, i) => (grid[p] = kept[i]));
        yield Math.min(0.99, done / total);
      }
    }

    // Medium that still falls to singles: look for the removal that makes it need level 2 (see step 3 above).
    if (deepMedium && !hardEnough(g, grid, level)) {
      const order = [...shuffle(mirrorPairs(g), rng), ...shuffle(g.cells.map((p) => [p]), rng)];
      let tries = 0;
      let found = false;
      while (!found && tries < deepTries) {
        let step: number[] | null = null; // first removal that keeps level 2 (and singles)
        for (const group of order) {
          if (tries >= deepTries) break;
          if (group.some((p) => grid[p] === 0) || givens - group.length < deepMin) continue;
          tries++;
          done++;
          const kept = group.map((p) => grid[p]);
          for (const p of group) grid[p] = 0;
          if (solvableAt(g, grid, 2)) {
            if (!solvableAt(g, grid, 1)) {
              givens -= group.length;
              found = true;
              break;
            }
            if (!step) step = group;
          }
          group.forEach((p, i) => (grid[p] = kept[i]));
          yield Math.min(0.99, done / total);
        }
        if (found || !step || tries >= deepTries) break;
        for (const p of step) grid[p] = 0;
        givens -= step.length;
      }
    }

    puzzle = { variant, level, seed, givens: toText(grid), solution: toText(solution) };
    if (hardEnough(g, grid, level)) break;
  }
  return puzzle!;
}

/** The whole generation in one go (tests, Node). */
export function generate(variant: Variant, level: Level, seed: number): Puzzle {
  const it = generateSteps(variant, level, seed);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

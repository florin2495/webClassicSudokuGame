// Puzzle generator. Pure and deterministic (same variant, level and seed = same puzzle), unit-tested.
// 1. A random full grid (src/lib/solver.ts).
// 2. Digits are taken out in pairs that mirror each other through the centre (180°, the classic look), in random
//    order. A removal stays only if the puzzle is still fine for the level:
//    - easy:   solvable with singles only, and at least 47% of the cells stay given;
//    - medium: solvable with singles, locked candidates and naked pairs/triples, at least 39% given;
//    - hard:   exactly one solution (proven by search), down to 29% given, then single cells too.
//    Logic-solvable means unique, so every level has exactly one solution.
// 3. Hard: if the result still falls to singles alone, try again with a new grid (up to 6 grids; each takes
//    well under 100 ms, even for a Samurai).
// `generateSteps` yields between removals so the page can run it in slices without freezing.
import { geometry, type Geometry, type Variant } from "./geometry";
import { solvableAt } from "./logic";
import { hasUniqueSolution, randomSolution } from "./solver";

export type Level = "easy" | "medium" | "hard";
export const LEVELS: readonly Level[] = ["easy", "medium", "hard"];
export const LEVEL_NAMES: Record<Level, string> = { easy: "Ușor", medium: "Mediu", hard: "Greu" };

export function isLevel(x: unknown): x is Level {
  return x === "easy" || x === "medium" || x === "hard";
}

/** Share of the cells that stay given, at least. */
export const MIN_GIVEN_SHARE: Record<Level, number> = { easy: 0.47, medium: 0.39, hard: 0.29 };

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

/** Is the grid still a good puzzle for the level? */
export function fitsLevel(g: Geometry, grid: ArrayLike<number>, level: Level): boolean {
  if (level === "easy") return solvableAt(g, grid, 1);
  if (level === "medium") return solvableAt(g, grid, 2);
  return hasUniqueSolution(g, grid);
}

/** Yields the progress (0..1) between removals; returns the puzzle. */
export function* generateSteps(variant: Variant, level: Level, seed: number): Generator<number, Puzzle, void> {
  const g = geometry(variant);
  const rng = mulberry32(seed);
  const minGivens = Math.ceil(g.cells.length * MIN_GIVEN_SHARE[level]);
  const attempts = level === "hard" ? 6 : 1;
  let puzzle: Puzzle | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const solution = randomSolution(g, rng);
    const grid = solution.slice();
    let givens = g.cells.length;
    const passes: number[][][] = [shuffle(mirrorPairs(g), rng)];
    if (level === "hard") passes.push(shuffle(g.cells.map((p) => [p]), rng));
    const total = passes.reduce((n, pass) => n + pass.length, 0) * attempts;
    let done = attempt * (total / attempts);

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

    puzzle = { variant, level, seed, givens: toText(grid), solution: toText(solution) };
    // A hard puzzle should need more than singles; keep the last try if none does.
    if (level !== "hard" || !solvableAt(g, grid, 1)) break;
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

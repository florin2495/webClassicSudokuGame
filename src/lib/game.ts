// A game in progress: the puzzle, what the player wrote, notes, clock. Pure (every action returns a new state or
// null when nothing changes), unit-tested. Saved as JSON in localStorage (src/lib/store.ts).
import { geometry, isVariant, type Geometry, type Variant } from "./geometry";
import { isLevel, type Level, type Puzzle } from "./generate";
import { ALL, POP } from "./solver";

export interface GameState {
  v: 1;
  variant: Variant;
  level: Level;
  seed: number;
  givens: string;
  solution: string;
  /** Digit in every position (givens included), 0 = empty. */
  values: number[];
  /** Pencil marks: 9-bit mask per position. */
  notes: number[];
  /** Positions filled by "Indiciu". */
  hinted: number[];
  elapsedMs: number;
  /** The first digit or note has been written (the game counts as played). */
  started: boolean;
  won: boolean;
  /** The win animation has been shown (no replay after a reload). */
  celebrated: boolean;
  moves: number;
  hints: number;
}

export const isGiven = (g: GameState, p: number) => g.givens.charCodeAt(p) !== 48; // "0"
export const solutionAt = (g: GameState, p: number) => g.solution.charCodeAt(p) - 48;
export const geometryOf = (g: GameState): Geometry => geometry(g.variant);

export function newGame(puzzle: Puzzle): GameState {
  const values = Array.from(puzzle.givens, (ch) => Number(ch));
  return {
    v: 1,
    variant: puzzle.variant,
    level: puzzle.level,
    seed: puzzle.seed,
    givens: puzzle.givens,
    solution: puzzle.solution,
    values,
    notes: new Array<number>(values.length).fill(0),
    hinted: [],
    elapsedMs: 0,
    started: false,
    won: false,
    celebrated: false,
    moves: 0,
    hints: 0,
  };
}

/** Every cell holds its solution digit. */
export function isComplete(g: GameState): boolean {
  return geometryOf(g).cells.every((p) => g.values[p] === solutionAt(g, p));
}

export const isFull = (g: GameState) => geometryOf(g).cells.every((p) => g.values[p] !== 0);

function settle(g: GameState): GameState {
  return isComplete(g) ? { ...g, won: true, notes: g.notes.map(() => 0) } : g;
}

/** Can the player change this cell? */
export const editable = (g: GameState, p: number) => !g.won && geometryOf(g).active[p] && !isGiven(g, p);

/** Write digit d in cell p (the same digit again clears it). The digit leaves the notes of every peer. */
export function setDigit(g: GameState, p: number, d: number): GameState | null {
  if (!editable(g, p) || d < 1 || d > 9) return null;
  const values = g.values.slice();
  const notes = g.notes.slice();
  if (values[p] === d) {
    values[p] = 0;
  } else {
    values[p] = d;
    notes[p] = 0;
    const b = 1 << (d - 1);
    for (const q of geometryOf(g).peers[p]) notes[q] &= ~b;
  }
  const hinted = g.hinted.includes(p) ? g.hinted.filter((q) => q !== p) : g.hinted;
  return settle({ ...g, values, notes, hinted, started: true, moves: g.moves + 1 });
}

/** Toggle pencil mark d in an empty cell. */
export function toggleNote(g: GameState, p: number, d: number): GameState | null {
  if (!editable(g, p) || g.values[p] !== 0 || d < 1 || d > 9) return null;
  const notes = g.notes.slice();
  notes[p] ^= 1 << (d - 1);
  return { ...g, notes, started: true };
}

/** Clear the digit of a cell, or its notes when it has no digit. */
export function erase(g: GameState, p: number): GameState | null {
  if (!editable(g, p)) return null;
  if (g.values[p] !== 0) {
    const values = g.values.slice();
    values[p] = 0;
    return { ...g, values, hinted: g.hinted.filter((q) => q !== p), moves: g.moves + 1 };
  }
  if (g.notes[p] === 0) return null;
  const notes = g.notes.slice();
  notes[p] = 0;
  return { ...g, notes };
}

/** Digits still possible in cell p, given the digits on the board now. */
export function candidatesAt(g: GameState, p: number): number {
  let m = ALL;
  for (const q of geometryOf(g).peers[p]) if (g.values[q]) m &= ~(1 << (g.values[q] - 1));
  return m;
}

/** Every empty cell gets all the digits still possible in it as notes. */
export function fillNotes(g: GameState): GameState | null {
  if (g.won) return null;
  const notes = g.notes.slice();
  let changed = false;
  for (const p of geometryOf(g).cells) {
    if (g.values[p] !== 0) continue;
    const m = candidatesAt(g, p);
    if (notes[p] !== m) {
      notes[p] = m;
      changed = true;
    }
  }
  return changed ? { ...g, notes, started: true } : null;
}

/** Cells whose digit is also in one of their rows, columns or regions. */
export function conflicts(g: GameState): Set<number> {
  const out = new Set<number>();
  const geo = geometryOf(g);
  for (const p of geo.cells) {
    const d = g.values[p];
    if (d && geo.peers[p].some((q) => g.values[q] === d)) out.add(p);
  }
  return out;
}

/** Cells the player filled with a digit that is not the solution's. */
export function wrongCells(g: GameState): number[] {
  return geometryOf(g).cells.filter((p) => g.values[p] !== 0 && !isGiven(g, p) && g.values[p] !== solutionAt(g, p));
}

/** How many more times each digit (index 1..9) has to be written. */
export function remaining(g: GameState): number[] {
  const geo = geometryOf(g);
  const out = new Array<number>(10).fill(geo.cells.length / 9);
  out[0] = 0;
  for (const p of geo.cells) if (g.values[p]) out[g.values[p]]--;
  return out;
}

export type Hint = { kind: "wrong"; pos: number } | { kind: "fill"; pos: number; digit: number };

/**
 * What "Indiciu" does: first point at a wrong digit (the selected cell first), else fill a cell with its solution
 * digit: the selected one if it is empty, otherwise the empty cell with the fewest possible digits.
 */
export function findHint(g: GameState, selected: number | null): Hint | null {
  if (g.won) return null;
  const wrong = wrongCells(g);
  if (wrong.length > 0) return { kind: "wrong", pos: selected !== null && wrong.includes(selected) ? selected : wrong[0] };
  if (selected !== null && editable(g, selected) && g.values[selected] === 0) {
    return { kind: "fill", pos: selected, digit: solutionAt(g, selected) };
  }
  let best = -1;
  let bestN = 10;
  for (const p of geometryOf(g).cells) {
    if (g.values[p] !== 0) continue;
    const n = POP[candidatesAt(g, p)];
    if (n < bestN) {
      best = p;
      bestN = n;
    }
  }
  return best < 0 ? null : { kind: "fill", pos: best, digit: solutionAt(g, best) };
}

/** Fill cell p with its solution digit, as a hint. */
export function applyHint(g: GameState, p: number): GameState | null {
  if (!editable(g, p) || g.values[p] === solutionAt(g, p)) return null;
  const next = setDigit({ ...g, values: g.values.map((v, i) => (i === p ? 0 : v)) }, p, solutionAt(g, p));
  if (!next) return null;
  return settle({ ...next, hinted: [...next.hinted, p], hints: g.hints + 1 });
}

/** Time passes (only for a started, unfinished game). */
export function tick(g: GameState, ms: number): GameState {
  if (!g.started || g.won || ms <= 0) return g;
  return { ...g, elapsedMs: g.elapsedMs + ms };
}

/** A saved game read back from storage: anything that does not fit is thrown away (a new game starts). */
export function isValidGame(x: unknown): x is GameState {
  if (!x || typeof x !== "object") return false;
  const g = x as Partial<GameState>;
  if (g.v !== 1 || !isVariant(g.variant) || !isLevel(g.level)) return false;
  const size = geometry(g.variant).size;
  const digits = (s: unknown) => typeof s === "string" && s.length === size && /^[0-9]+$/.test(s);
  const nums = (a: unknown, max: number) =>
    Array.isArray(a) && a.length === size && a.every((v) => Number.isInteger(v) && v >= 0 && v <= max);
  return (
    digits(g.givens) &&
    digits(g.solution) &&
    nums(g.values, 9) &&
    nums(g.notes, 511) &&
    Array.isArray(g.hinted) &&
    g.hinted.every((v) => Number.isInteger(v)) &&
    typeof g.seed === "number" &&
    typeof g.elapsedMs === "number" &&
    typeof g.started === "boolean" &&
    typeof g.won === "boolean" &&
    typeof g.celebrated === "boolean" &&
    typeof g.moves === "number" &&
    typeof g.hints === "number"
  );
}

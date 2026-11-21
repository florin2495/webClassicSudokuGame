// Sudoku solver for any board of src/lib/geometry.ts. Pure, unit-tested.
// Candidates are 9-bit masks (bit d-1 = digit d). Placing a digit removes it from every peer and places naked
// singles at once; `propagate` adds hidden singles; `search` is a depth-first search on the cell with the fewest
// candidates. Used to fill a random solution and to prove a puzzle has exactly one solution.
import type { Geometry } from "./geometry";

export const ALL = 0x1ff;

/** POP[mask] = number of digits in the mask. */
export const POP = new Uint8Array(512);
/** DIGIT[mask] = the digit of a one-digit mask (else 0). */
export const DIGIT = new Uint8Array(512);
for (let m = 1; m < 512; m++) {
  POP[m] = POP[m >> 1] + (m & 1);
  if (POP[m] === 1) DIGIT[m] = 31 - Math.clz32(m) + 1;
}

export const bit = (d: number) => 1 << (d - 1);

/** Digits of a mask, smallest first. */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) out.push(d);
  return out;
}

export interface SolveState {
  val: Uint8Array;
  cand: Uint16Array;
}

const clone = (s: SolveState): SolveState => ({ val: s.val.slice(), cand: s.cand.slice() });

/** Put digit d in cell p, then every naked single that follows. False on a contradiction. */
export function place(g: Geometry, st: SolveState, p: number, d: number): boolean {
  const stack = [p, d];
  while (stack.length > 0) {
    const dd = stack.pop()!;
    const c = stack.pop()!;
    if (st.val[c]) {
      if (st.val[c] !== dd) return false;
      continue;
    }
    const b = 1 << (dd - 1);
    if (!(st.cand[c] & b)) return false;
    st.val[c] = dd;
    st.cand[c] = b;
    for (const q of g.peers[c]) {
      if (st.val[q]) {
        if (st.val[q] === dd) return false;
        continue;
      }
      if (st.cand[q] & b) {
        const m = st.cand[q] & ~b;
        if (!m) return false;
        st.cand[q] = m;
        if (POP[m] === 1) stack.push(q, DIGIT[m]);
      }
    }
  }
  return true;
}

/** Remove digits `mask` from cell p (placing it if one digit is left). False on a contradiction. */
export function eliminate(g: Geometry, st: SolveState, p: number, mask: number): boolean {
  if (st.val[p] || !(st.cand[p] & mask)) return true;
  const m = st.cand[p] & ~mask;
  if (!m) return false;
  st.cand[p] = m;
  return POP[m] === 1 ? place(g, st, p, DIGIT[m]) : true;
}

/** Board state from a grid (0 = empty, inactive positions ignored), or null when the givens already clash. */
export function initState(g: Geometry, grid: ArrayLike<number>): SolveState | null {
  const st: SolveState = { val: new Uint8Array(g.size), cand: new Uint16Array(g.size) };
  for (const p of g.cells) st.cand[p] = ALL;
  for (const p of g.cells) {
    const d = grid[p];
    if (d && !place(g, st, p, d)) return null;
  }
  return st;
}

/** Hidden singles in every unit until nothing changes. False on a contradiction (a digit with no place). */
export function propagate(g: Geometry, st: SolveState): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const u of g.units) {
      let once = 0;
      let twice = 0;
      let solved = 0;
      for (const p of u) {
        if (st.val[p]) solved |= 1 << (st.val[p] - 1);
        else {
          twice |= once & st.cand[p];
          once |= st.cand[p];
        }
      }
      if ((once | solved) !== ALL) return false;
      let singles = once & ~twice & ~solved;
      while (singles) {
        const b = singles & -singles;
        singles &= ~b;
        const d = DIGIT[b];
        const p = u.find((q) => !st.val[q] && st.cand[q] & b);
        if (p === undefined) {
          if (!u.some((q) => st.val[q] === d)) return false;
          continue;
        }
        if (!place(g, st, p, d)) return false;
        changed = true;
      }
    }
  }
  return true;
}

export const isSolved = (g: Geometry, st: SolveState) => g.cells.every((p) => st.val[p] !== 0);

export interface SearchResult {
  /** Solutions found (at most `limit`), each a full grid by position. */
  solutions: Uint8Array[];
  /** The node budget ran out before the search finished: the count is a lower bound. */
  aborted: boolean;
}

/**
 * Depth-first search for up to `limit` solutions. `rng` shuffles the digit order (random fills);
 * `maxNodes` bounds the work (then `aborted` is true).
 */
export function solve(
  g: Geometry,
  grid: ArrayLike<number>,
  { limit = 2, maxNodes = 200_000, rng }: { limit?: number; maxNodes?: number; rng?: () => number } = {},
): SearchResult {
  const out: SearchResult = { solutions: [], aborted: false };
  const st = initState(g, grid);
  if (!st || !propagate(g, st)) return out;
  let nodes = 0;
  const search = (s: SolveState) => {
    if (out.solutions.length >= limit || out.aborted) return;
    if (++nodes > maxNodes) {
      out.aborted = true;
      return;
    }
    let best = -1;
    let bestPop = 10;
    for (const p of g.cells) {
      if (s.val[p]) continue;
      const n = POP[s.cand[p]];
      if (n < bestPop) {
        best = p;
        bestPop = n;
        if (n <= 2) break;
      }
    }
    if (best < 0) {
      out.solutions.push(s.val.slice());
      return;
    }
    const ds = digitsOf(s.cand[best]);
    if (rng) {
      for (let i = ds.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ds[i], ds[j]] = [ds[j], ds[i]];
      }
    }
    for (const d of ds) {
      const next = clone(s);
      if (place(g, next, best, d) && propagate(g, next)) search(next);
      if (out.solutions.length >= limit || out.aborted) return;
    }
  };
  search(st);
  return out;
}

/** Exactly one solution (proven: the search finished within its budget). */
export function hasUniqueSolution(g: Geometry, grid: ArrayLike<number>, maxNodes = 20_000): boolean {
  const r = solve(g, grid, { limit: 2, maxNodes });
  return !r.aborted && r.solutions.length === 1;
}

/** A random full grid. */
export function randomSolution(g: Geometry, rng: () => number): Uint8Array {
  const empty = new Uint8Array(g.size);
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = solve(g, empty, { limit: 1, maxNodes: 20_000, rng });
    if (r.solutions.length === 1) return r.solutions[0];
  }
  throw new Error(`no ${g.variant} grid found`);
}

export { clone as cloneState };

// Human-style solving, used to grade puzzles. Pure, unit-tested.
// Level 1: naked and hidden singles only (an easy puzzle).
// Level 2: also locked candidates (pointing / claiming, for any two units that cross, so it works for the jigsaw
// and the Samurai too) and naked pairs and triples (a medium puzzle).
// Every step only removes impossible digits, so a puzzle solved this way has exactly one solution.
import type { Geometry } from "./geometry";
import { eliminate, initState, isSolved, POP, propagate, type SolveState } from "./solver";

export type LogicLevel = 1 | 2;

/** Locked candidates: a digit whose places in unit A all lie in unit B leaves the rest of B. True if it removed any. */
function lockedCandidates(g: Geometry, st: SolveState): boolean | null {
  let progress = false;
  for (let a = 0; a < g.units.length; a++) {
    const u = g.units[a];
    for (let d = 1; d <= 9; d++) {
      const b = 1 << (d - 1);
      const places: number[] = [];
      let solved = false;
      for (const p of u) {
        if (st.val[p] === d) {
          solved = true;
          break;
        }
        if (!st.val[p] && st.cand[p] & b) places.push(p);
      }
      if (solved || places.length < 2) continue;
      for (const other of g.unitsOf[places[0]]) {
        if (other === a) continue;
        const base = other * g.size;
        if (!places.every((p) => g.member[base + p])) continue;
        for (const q of g.units[other]) {
          if (g.member[a * g.size + q] || st.val[q] || !(st.cand[q] & b)) continue;
          if (!eliminate(g, st, q, b)) return null;
          progress = true;
        }
      }
    }
  }
  return progress;
}

/** Naked pairs and triples: n cells of a unit that together hold only n digits keep them for themselves. */
function nakedSubsets(g: Geometry, st: SolveState): boolean | null {
  let progress = false;
  for (const u of g.units) {
    const open = u.filter((p) => !st.val[p] && POP[st.cand[p]] <= 3);
    const n = open.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pair = st.cand[open[i]] | st.cand[open[j]];
        if (POP[pair] === 2 && !st.val[open[i]] && !st.val[open[j]]) {
          for (const q of u) {
            if (q === open[i] || q === open[j] || st.val[q] || !(st.cand[q] & pair)) continue;
            if (!eliminate(g, st, q, pair)) return null;
            progress = true;
          }
        }
        for (let k = j + 1; k < n; k++) {
          const triple = pair | st.cand[open[k]];
          if (POP[triple] !== 3 || st.val[open[i]] || st.val[open[j]] || st.val[open[k]]) continue;
          for (const q of u) {
            if (q === open[i] || q === open[j] || q === open[k] || st.val[q] || !(st.cand[q] & triple)) continue;
            if (!eliminate(g, st, q, triple)) return null;
            progress = true;
          }
        }
      }
    }
  }
  return progress;
}

/** Solve with the techniques of `level` only. Returns the solved state, or null if those techniques get stuck. */
export function solveLogically(g: Geometry, grid: ArrayLike<number>, level: LogicLevel): SolveState | null {
  const st = initState(g, grid);
  if (!st) return null;
  for (;;) {
    if (!propagate(g, st)) return null;
    if (isSolved(g, st)) return st;
    if (level < 2) return null;
    const locked = lockedCandidates(g, st);
    if (locked === null) return null;
    if (locked) continue;
    const subsets = nakedSubsets(g, st);
    if (subsets === null) return null;
    if (!subsets) return null;
  }
}

export const solvableAt = (g: Geometry, grid: ArrayLike<number>, level: LogicLevel) => solveLogically(g, grid, level) !== null;

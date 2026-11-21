import { describe, expect, it } from "vitest";
import {
  applyHint,
  candidatesAt,
  conflicts,
  erase,
  fillNotes,
  findHint,
  isComplete,
  isFull,
  isValidGame,
  newGame,
  remaining,
  setDigit,
  solutionAt,
  tick,
  toggleNote,
  wrongCells,
  type GameState,
} from "./game";
import { generate, type Puzzle } from "./generate";
import { geometry } from "./geometry";
import { WIKI_PUZZLE, WIKI_SOLUTION } from "./test-utils";

const WIKI: Puzzle = { variant: "classic", level: "easy", seed: 1, givens: WIKI_PUZZLE, solution: WIKI_SOLUTION };
const empties = (g: GameState) => geometry(g.variant).cells.filter((p) => g.values[p] === 0);

/** Fill every empty cell with its solution digit. */
function solveAll(g: GameState): GameState {
  let s = g;
  for (const p of empties(g)) s = setDigit(s, p, solutionAt(s, p))!;
  return s;
}

describe("game", () => {
  it("starts with the givens on the board and nothing else", () => {
    const g = newGame(WIKI);
    expect(g.values[0]).toBe(5);
    expect(g.values[2]).toBe(0);
    expect(g.started).toBe(false);
    expect(empties(g)).toHaveLength(51);
    expect(isValidGame(g)).toBe(true);
  });

  it("givens cannot change; a digit goes in, the same digit again takes it out", () => {
    const g = newGame(WIKI);
    expect(setDigit(g, 0, 1)).toBeNull();
    const a = setDigit(g, 2, 4)!;
    expect(a.values[2]).toBe(4);
    expect(a.started).toBe(true);
    expect(a.moves).toBe(1);
    const b = setDigit(a, 2, 4)!;
    expect(b.values[2]).toBe(0);
    expect(setDigit(g, 2, 0)).toBeNull();
    expect(setDigit(g, 2, 10)).toBeNull();
  });

  it("notes: toggle in empty cells only, cleared from peers when a digit is placed", () => {
    let g = newGame(WIKI);
    g = toggleNote(g, 2, 4)!;
    g = toggleNote(g, 2, 1)!;
    expect(g.notes[2]).toBe(0b1001);
    g = toggleNote(g, 2, 1)!;
    expect(g.notes[2]).toBe(0b1000);
    g = toggleNote(g, 3, 4)!; // same row
    g = toggleNote(g, 40, 4)!; // not a peer of cell 2
    g = setDigit(g, 2, 4)!;
    expect(g.notes[2]).toBe(0);
    expect(g.notes[3]).toBe(0);
    expect(g.notes[40]).toBe(0b1000);
    expect(toggleNote(g, 2, 5)).toBeNull(); // has a digit
    expect(toggleNote(g, 0, 5)).toBeNull(); // given
  });

  it("erase takes the digit first, then the notes", () => {
    let g = newGame(WIKI);
    expect(erase(g, 2)).toBeNull();
    g = toggleNote(g, 2, 7)!;
    g = setDigit(g, 3, 6)!;
    expect(erase(g, 3)!.values[3]).toBe(0);
    expect(erase(g, 2)!.notes[2]).toBe(0);
    expect(erase(g, 0)).toBeNull();
  });

  it("finds clashes and wrong digits", () => {
    let g = newGame(WIKI);
    g = setDigit(g, 2, 5)!; // 5 already in row 0
    expect(conflicts(g)).toEqual(new Set([0, 2]));
    expect(wrongCells(g)).toEqual([2]);
    g = setDigit(g, 2, 4)!; // the right digit
    expect(conflicts(g).size).toBe(0);
    expect(wrongCells(g)).toEqual([]);
  });

  it("candidates, all notes and the digits still to place", () => {
    const g = newGame(WIKI);
    expect(candidatesAt(g, 2)).toBe((1 << 0) | (1 << 1) | (1 << 3)); // 1, 2, 4
    const n = fillNotes(g)!;
    expect(n.notes[2]).toBe(candidatesAt(g, 2));
    expect(n.notes[0]).toBe(0);
    expect(fillNotes(n)).toBeNull();
    const left = remaining(g);
    expect(left.slice(1).reduce((a, b) => a + b, 0)).toBe(51);
    expect(left[5]).toBe(9 - 3);
  });

  it("hint: a wrong digit first, then the selected empty cell, then the easiest cell", () => {
    let g = newGame(WIKI);
    const wrong = setDigit(g, 2, 5)!;
    expect(findHint(wrong, null)).toEqual({ kind: "wrong", pos: 2 });
    expect(findHint(g, 3)).toEqual({ kind: "fill", pos: 3, digit: 6 });
    const h = findHint(g, null)!;
    expect(h.kind).toBe("fill");
    g = applyHint(g, h.pos)!;
    expect(g.values[h.pos]).toBe(solutionAt(g, h.pos));
    expect(g.hinted).toEqual([h.pos]);
    expect(g.hints).toBe(1);
    expect(applyHint(g, h.pos)).toBeNull();
    expect(applyHint(wrong, 2)!.values[2]).toBe(4);
  });

  it("wins when every cell holds its solution digit; a full grid with a mistake does not win", () => {
    const g = newGame(WIKI);
    const done = solveAll(g);
    expect(done.won).toBe(true);
    expect(isComplete(done)).toBe(true);
    expect(setDigit(done, 2, 1)).toBeNull();
    const last = empties(g).at(-1)!;
    let almost = g;
    for (const p of empties(g)) if (p !== last) almost = setDigit(almost, p, solutionAt(g, p))!;
    const wrongDigit = (solutionAt(g, last) % 9) + 1;
    const full = setDigit(almost, last, wrongDigit)!;
    expect(isFull(full)).toBe(true);
    expect(full.won).toBe(false);
  });

  it("the clock runs only for a started game that is not won", () => {
    const g = newGame(WIKI);
    expect(tick(g, 1000)).toBe(g);
    const s = setDigit(g, 2, 4)!;
    expect(tick(s, 1000).elapsedMs).toBe(1000);
    expect(tick(solveAll(g), 1000).elapsedMs).toBe(0);
  });

  it("works the same on a Samurai: a digit in a shared box clears notes in both grids", () => {
    const p = generate("samurai", "easy", 8);
    let g = newGame(p);
    const geo = geometry("samurai");
    const shared = geo.cells.find((q) => geo.unitsOf[q].length === 5 && g.values[q] === 0)!;
    const d = solutionAt(g, shared);
    const peers = geo.peers[shared].filter((q) => g.values[q] === 0 && candidatesAt(g, q) & (1 << (d - 1)));
    for (const q of peers) g = toggleNote(g, q, d)!;
    g = setDigit(g, shared, d)!;
    for (const q of peers) expect(g.notes[q] & (1 << (d - 1))).toBe(0);
    expect(remaining(g).slice(1).every((n) => n <= 41)).toBe(true);
    expect(solveAll(g).won).toBe(true);
  });

  it("throws away saved games that do not fit", () => {
    const g = newGame(WIKI);
    expect(isValidGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isValidGame(null)).toBe(false);
    expect(isValidGame({ ...g, v: 2 })).toBe(false);
    expect(isValidGame({ ...g, variant: "x" })).toBe(false);
    expect(isValidGame({ ...g, variant: "samurai" })).toBe(false); // wrong size
    expect(isValidGame({ ...g, values: g.values.slice(1) })).toBe(false);
    expect(isValidGame({ ...g, notes: g.notes.map(() => 600) })).toBe(false);
    expect(isValidGame({ ...g, givens: g.givens.replace("5", "x") })).toBe(false);
  });
});

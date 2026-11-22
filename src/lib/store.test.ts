import { beforeEach, describe, expect, it } from "vitest";
import { newGame, solutionAt } from "./game";
import { generate, type Puzzle } from "./generate";
import { geometry } from "./geometry";
import { actions, EMPTY_LEVEL_STATS, getSnapshot, parseSettings, parseStats, statsKey, updateStats } from "./store";
import { WIKI_PUZZLE, WIKI_SOLUTION } from "./test-utils";

const WIKI: Puzzle = { variant: "classic", level: "medium", seed: 1, givens: WIKI_PUZZLE, solution: WIKI_SOLUTION };

// Runs in Node: no window / localStorage, so the store keeps everything in memory (the same code path as blocked storage).
describe("store", () => {
  beforeEach(() => {
    actions.startPuzzle(WIKI);
    actions.resetStats();
  });

  it("starts a ready puzzle and remembers its type and level for the next dialog", () => {
    const s = getSnapshot();
    expect(s.game?.givens).toBe(WIKI_PUZZLE);
    expect(s.settings.variant).toBe("classic");
    expect(s.settings.level).toBe("medium");
    expect(s.canUndo).toBe(false);
    expect(s.generating).toBeNull();
  });

  it("counts a game as played at the first digit, and undoes moves", () => {
    expect(actions.digit(2, 4)).toBe(true);
    expect(getSnapshot().stats[statsKey("classic", "medium")]).toEqual({ played: 1, won: 0, bestMs: null });
    expect(actions.note(3, 6)).toBe(true);
    expect(getSnapshot().canUndo).toBe(true);
    expect(actions.undo()).toBe(true);
    expect(getSnapshot().game?.notes[3]).toBe(0);
    expect(actions.undo()).toBe(true);
    expect(getSnapshot().game?.values[2]).toBe(0);
    expect(getSnapshot().canUndo).toBe(false);
    expect(actions.undo()).toBe(false);
    expect(actions.digit(0, 1)).toBe(false); // given
  });

  it("records a win with its time, per type and level", () => {
    const g = getSnapshot().game!;
    const cells = geometry("classic").cells.filter((p) => g.values[p] === 0);
    actions.digit(cells[0], solutionAt(g, cells[0]));
    actions.tick(5000);
    for (const p of cells.slice(1)) actions.digit(p, solutionAt(g, p));
    const s = getSnapshot();
    expect(s.game?.won).toBe(true);
    expect(s.canUndo).toBe(false);
    expect(actions.undo()).toBe(false);
    expect(s.stats[statsKey("classic", "medium")]).toEqual({ played: 1, won: 1, bestMs: 5000 });
    actions.markCelebrated();
    expect(getSnapshot().game?.celebrated).toBe(true);
    expect(getSnapshot().game?.resultClosed).toBe(false);
    actions.closeResult();
    expect(getSnapshot().game?.resultClosed).toBe(true);
  });

  it("hint and all notes are undoable moves", () => {
    expect(actions.fillNotes()).toBe(true);
    expect(getSnapshot().game?.notes[2]).not.toBe(0);
    expect(actions.hint(2)).toBe(true);
    expect(getSnapshot().game?.values[2]).toBe(4);
    expect(getSnapshot().game?.hints).toBe(1);
    actions.undo();
    actions.undo();
    expect(getSnapshot().game?.notes[2]).toBe(0);
  });

  it("generates in slices and then starts the puzzle", async () => {
    actions.startNew("tree", "easy", 5);
    expect(getSnapshot().generating).toMatchObject({ variant: "tree", level: "easy", seed: 5 });
    for (let i = 0; i < 400 && getSnapshot().generating; i++) await new Promise((r) => setTimeout(r, 5));
    const s = getSnapshot();
    expect(s.generating).toBeNull();
    expect(s.game?.variant).toBe("tree");
    expect(s.game?.givens).toBe(generate("tree", "easy", 5).givens);
    expect(s.settings.variant).toBe("tree");
  });

  it("a newer request wins over one still generating", async () => {
    actions.startNew("samurai", "hard", 5);
    actions.startNew("classic", "easy", 6);
    for (let i = 0; i < 400 && getSnapshot().generating; i++) await new Promise((r) => setTimeout(r, 5));
    expect(getSnapshot().game?.variant).toBe("classic");
    expect(getSnapshot().game?.seed).toBe(6);
  });
});

describe("settings and stats", () => {
  it("reads back stored settings and stats defensively", () => {
    expect(parseSettings(null)).toEqual({ mistakes: "conflicts", timer: true, variant: "classic", level: "easy" });
    expect(parseSettings({ mistakes: "solution", timer: false, variant: "samurai", level: "hard" })).toEqual({
      mistakes: "solution",
      timer: false,
      variant: "samurai",
      level: "hard",
    });
    expect(parseSettings({ mistakes: "x", variant: "y", level: "z" })).toMatchObject({ mistakes: "conflicts", variant: "classic", level: "easy" });
    expect(parseStats({ "tree:hard": { played: 3, won: "x", bestMs: 12 }, "bogus:easy": { played: 1 } })).toEqual({
      "tree:hard": { played: 3, won: 0, bestMs: 12 },
    });
  });

  it("counts played at the start and won with the best time", () => {
    const g = newGame(WIKI);
    const started = { ...g, started: true };
    let s = updateStats({}, g, started);
    expect(s[statsKey("classic", "medium")]).toEqual({ ...EMPTY_LEVEL_STATS, played: 1 });
    s = updateStats(s, started, { ...started, won: true, elapsedMs: 90_000 });
    s = updateStats(s, started, { ...started, won: true, elapsedMs: 120_000 });
    expect(s[statsKey("classic", "medium")]).toEqual({ played: 1, won: 2, bestMs: 90_000 });
    expect(updateStats(s, started, started)).toBe(s);
  });
});

// Client-side store for useSyncExternalStore: the current game, undo history, settings, statistics and the puzzle
// being generated. Everything is kept in localStorage, so closing the app (or reloading for an update) never loses
// a game. A new puzzle is generated in small slices (generateSteps) so the page never freezes, even for a Samurai.
import { isVariant, VARIANTS, type Variant } from "./geometry";
import { generateSteps, isLevel, LEVELS, randomSeed, type Level, type Puzzle } from "./generate";
import { applyHint, erase, fillNotes, isValidGame, newGame, setDigit, tick, toggleNote, type GameState } from "./game";

export type MistakeMode = "conflicts" | "solution";

export interface Settings {
  /** Red digits: only clashes with another digit, or every digit that differs from the solution. */
  mistakes: MistakeMode;
  timer: boolean;
  /** Last choice in the "new game" dialog. */
  variant: Variant;
  level: Level;
}

export interface LevelStats {
  played: number;
  won: number;
  bestMs: number | null;
}

/** Keyed "variant:level", e.g. "samurai:hard". */
export type Stats = Record<string, LevelStats>;

export interface Generating {
  variant: Variant;
  level: Level;
  seed: number;
  progress: number;
}

export interface Snapshot {
  game: GameState | null;
  settings: Settings;
  stats: Stats;
  canUndo: boolean;
  generating: Generating | null;
}

export const KEY_GAME = "sudoku:game:v1";
export const KEY_SETTINGS = "sudoku:settings:v1";
export const KEY_STATS = "sudoku:stats:v1";
const HISTORY_MAX = 500;
/** Work per slice of generation before the page gets the thread back. */
const SLICE_MS = 24;

export const DEFAULT_SETTINGS: Settings = { mistakes: "conflicts", timer: true, variant: "classic", level: "easy" };

export const statsKey = (v: Variant, l: Level) => `${v}:${l}`;
export const EMPTY_LEVEL_STATS: LevelStats = { played: 0, won: 0, bestMs: null };

let snap: Snapshot | null = null;
let history: GameState[] = [];
let generation = 0;
const listeners = new Set<() => void>();

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked (or Node in the unit tests): the game keeps running in memory
  }
}

export function parseSettings(x: unknown): Settings {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Settings>;
  return {
    mistakes: o.mistakes === "solution" ? "solution" : "conflicts",
    timer: o.timer !== false,
    variant: isVariant(o.variant) ? o.variant : DEFAULT_SETTINGS.variant,
    level: isLevel(o.level) ? o.level : DEFAULT_SETTINGS.level,
  };
}

export function parseStats(x: unknown): Stats {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, Partial<LevelStats> | undefined>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const out: Stats = {};
  for (const v of VARIANTS) {
    for (const l of LEVELS) {
      const s = o[statsKey(v, l)];
      if (!s || typeof s !== "object") continue;
      out[statsKey(v, l)] = {
        played: n(s.played),
        won: n(s.won),
        bestMs: typeof s.bestMs === "number" && Number.isFinite(s.bestMs) && s.bestMs >= 0 ? s.bestMs : null,
      };
    }
  }
  return out;
}

function load(): Snapshot {
  const settings = parseSettings(readJson(KEY_SETTINGS));
  const stats = parseStats(readJson(KEY_STATS));
  const saved = readJson(KEY_GAME);
  // A fixed puzzle from the URL (tests) starts generating right away; the board shows the progress meanwhile.
  const fixed = typeof window !== "undefined" ? takeUrlPuzzle() : null;
  if (fixed) setTimeout(() => actions.startNew(fixed.variant, fixed.level, fixed.seed), 0);
  return {
    game: isValidGame(saved) ? saved : null,
    settings,
    stats,
    canUndo: false,
    generating: fixed ? { ...fixed, progress: 0 } : null,
  };
}

export function getSnapshot(): Snapshot {
  if (!snap) snap = load();
  return snap;
}

export function getServerSnapshot(): Snapshot | null {
  return null;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function commit(next: Snapshot, saveGame = true) {
  const prev = snap;
  snap = next;
  if (saveGame && prev?.game !== next.game) writeJson(KEY_GAME, next.game);
  if (prev?.settings !== next.settings) writeJson(KEY_SETTINGS, next.settings);
  if (prev?.stats !== next.stats) writeJson(KEY_STATS, next.stats);
  listeners.forEach((l) => l());
}

/** Statistics after the game went from `prev` to `next`. */
export function updateStats(stats: Stats, prev: GameState, next: GameState): Stats {
  const key = statsKey(next.variant, next.level);
  let s = stats[key] ?? EMPTY_LEVEL_STATS;
  if (!prev.started && next.started) s = { ...s, played: s.played + 1 };
  if (!prev.won && next.won) {
    s = { ...s, won: s.won + 1, bestMs: s.bestMs === null ? next.elapsedMs : Math.min(s.bestMs, next.elapsedMs) };
  }
  return s === (stats[key] ?? EMPTY_LEVEL_STATS) ? stats : { ...stats, [key]: s };
}

/** Apply a new game state as a player move (undoable). */
function apply(next: GameState | null): boolean {
  const cur = getSnapshot();
  if (!next || !cur.game) return false;
  history.push(cur.game);
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  commit({ ...cur, game: next, stats: updateStats(cur.stats, cur.game, next), canUndo: !next.won });
  return true;
}

const withGame = (f: (g: GameState) => GameState | null) => () => {
  const g = getSnapshot().game;
  return g ? apply(f(g)) : false;
};

/** Read and remove `?seed=N&type=classic|samurai|tree&level=easy|medium|hard` (fixed puzzles for the tests). */
export function takeUrlPuzzle(): { seed: number; variant: Variant; level: Level } | null {
  try {
    const q = new URLSearchParams(window.location.search);
    const seed = Number(q.get("seed"));
    if (!Number.isInteger(seed) || seed <= 0) return null;
    const type = q.get("type");
    const level = q.get("level");
    for (const k of ["seed", "type", "level"]) q.delete(k);
    const rest = q.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    return { seed, variant: isVariant(type) ? type : "classic", level: isLevel(level) ? level : "easy" };
  } catch {
    return null;
  }
}

export const actions = {
  digit(p: number, d: number): boolean {
    return withGame((g) => setDigit(g, p, d))();
  },
  note(p: number, d: number): boolean {
    return withGame((g) => toggleNote(g, p, d))();
  },
  erase(p: number): boolean {
    return withGame((g) => erase(g, p))();
  },
  hint(p: number): boolean {
    return withGame((g) => applyHint(g, p))();
  },
  fillNotes(): boolean {
    return withGame(fillNotes)();
  },
  undo(): boolean {
    const cur = getSnapshot();
    const prev = history.pop();
    if (!prev || !cur.game || cur.game.won) return false;
    // The clock keeps running: undo restores the board, not the time.
    commit({ ...cur, game: { ...prev, elapsedMs: cur.game.elapsedMs, started: true }, canUndo: history.length > 0 });
    return true;
  },
  tick(ms: number) {
    const cur = getSnapshot();
    if (!cur.game) return;
    const game = tick(cur.game, ms);
    if (game !== cur.game) commit({ ...cur, game });
  },
  /** Start a ready puzzle. */
  startPuzzle(puzzle: Puzzle) {
    const cur = getSnapshot();
    generation++;
    history = [];
    commit({
      ...cur,
      game: newGame(puzzle),
      canUndo: false,
      generating: null,
      settings: { ...cur.settings, variant: puzzle.variant, level: puzzle.level },
    });
  },
  /** Generate a new puzzle in slices (the board shows the progress), then start it. */
  startNew(variant: Variant, level: Level, seed: number = randomSeed()) {
    const id = ++generation;
    const steps = generateSteps(variant, level, seed);
    const cur = getSnapshot();
    commit({ ...cur, generating: { variant, level, seed, progress: 0 }, settings: { ...cur.settings, variant, level } }, false);
    const pump = () => {
      if (id !== generation) return; // replaced by a newer request
      const t0 = Date.now();
      let progress = 0;
      for (;;) {
        const r = steps.next();
        if (r.done) {
          actions.startPuzzle(r.value);
          return;
        }
        progress = r.value;
        if (Date.now() - t0 > SLICE_MS) break;
      }
      const now = getSnapshot();
      if (now.generating) commit({ ...now, generating: { ...now.generating, progress } }, false);
      setTimeout(pump, 0);
    };
    setTimeout(pump, 0);
  },
  updateSettings(patch: Partial<Settings>) {
    const cur = getSnapshot();
    commit({ ...cur, settings: parseSettings({ ...cur.settings, ...patch }) }, false);
  },
  markCelebrated() {
    const cur = getSnapshot();
    if (cur.game?.won && !cur.game.celebrated) commit({ ...cur, game: { ...cur.game, celebrated: true } });
  },
  /** The result dialog was closed: saved, so a reload does not bring it back. */
  closeResult() {
    const cur = getSnapshot();
    if (cur.game?.won && !cur.game.resultClosed) commit({ ...cur, game: { ...cur.game, resultClosed: true } });
  },
  resetStats() {
    const cur = getSnapshot();
    commit({ ...cur, stats: {} }, false);
  },
};

@AGENTS.md

# webClassicSudokuGame (Classic Sudoku) - project notes for Claude

Sudoku in three variants (game 13 of the hub), shown as "Classic Sudoku" (folder `D:\_DEv\013_ClassicSudoku`), for one
player, made for an Android phone. No ads, no account, works offline, installable as its own app. Single page; the whole
game (puzzle generation included) runs in the browser. Built like Classic Solitaire (`D:\_DEv\012_ClassicSolitaire`):
same PWA, update button, menu, feedback and test setup.

## Accounts and deploy
- GitHub: personal account **florin2495** only (repo `florin2495/webClassicSudokuGame`, public). Never the work account.
  Local git identity is pinned in `.git/config`.
- The user connects the repo to Vercel by hand: project `013_web-classic-sudoku-game`, domain
  `013web-classic-sudoku-game.vercel.app` (Vercel drops the `_`, like `012_web-classic-solitaire-game`). Once connected, every push to `main` deploys to production:
  https://games.hailatat.icu/classicsudoku (the hub proxies `/classicsudoku/*` to this project; `basePath: "/classicsudoku"`
  in `next.config.ts`, zone in the hub's `next.config.ts`).
- `vercel.json` pins `"framework": "nextjs"` and `"regions": ["fra1"]` (Frankfurt, next to the Supabase DB). Never remove it.
- Env vars (Vercel + `.env.local`, only for feedback): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Feedback (`POST /api/feedback`) writes to `hub_feedback` (owned by `florin2495/hailataticu-hub`, slug `sudoku`).
- Hub entry: `D:\_DEv\000_Startup\src\games.ts` (slug `sudoku`, url `/classicsudoku`).
- Ask the user before pushing (= deploying), unless they explicitly say to deploy.
- **Before every push, bump the patch version** in `package.json` (and `npm install --package-lock-only`). It is shown
  in the menu ("Versiunea x.y.z"), and it is what makes the update button appear on open copies of the game.

## Database
None of its own: no `sudoku_` tables, no migrations. Game, settings and statistics live in the browser's localStorage
(`sudoku:game:v1`, `sudoku:settings:v1`, `sudoku:stats:v1`). Changing the shape of a saved game needs a new key or a
migration in `src/lib/store.ts` (`isValidGame` throws away anything that does not fit, which silently drops the game).

## Design
- Boards: `src/lib/geometry.ts`. A cell is a position `r * width + c`; units are every group of 9 that holds 1..9 once.
  - `classic`: 9×9, rows, columns, 3×3 boxes.
  - `samurai` (Gattai-5): 21×21 with 369 active cells; corner grids at (0,0), (0,12), (12,0), (12,12), middle grid at
    (6,6). Each grid has its own 9 rows and 9 columns (a row never crosses into another grid); the 4 boxes shared by the
    middle grid and a corner grid are one unit that counts for both (131 units).
  - `tree` (Christmas tree, jigsaw): 9×9 rows and columns plus 9 irregular pieces from `TREE_LAYOUT` (our own split of
    the tree shape the user sent: vertex T, middle M, base R with the trunk, six pieces around). Shade 1 tree, 2 trunk, 3 star.
- Solver: `src/lib/solver.ts` (9-bit candidate masks, naked + hidden singles propagation, depth-first search on the cell
  with the fewest candidates, node budget). Graded logic: `src/lib/logic.ts` (level 1 singles; level 2 adds locked
  candidates for any two crossing units, so it also works on jigsaw and Samurai, and naked pairs/triples).
- Generator: `src/lib/generate.ts`, deterministic per (variant, level, seed) with `mulberry32`. Random full grid, then
  digits leave in 180° mirror pairs. Easy: stays solvable with singles, ≥47% of cells given. Medium: solvable with level-2
  logic, down to 39%, and it must NOT fall to singles alone (else it would be an easy one with fewer digits): if it still
  does at 39%, every further removal (pairs, then single cells) is tried and the first that makes it need level 2 ends
  it; otherwise one level-2 removal is made and the search goes on, down to 32% (`MEDIUM_DEEP_SHARE`), with a capped
  number of tries per grid (~48 000 / cells). Samurai medium is exempt (user's choice, 2026-11-22): one grid, plain pass
  to 39%, may fall to singles, because that search never got through its 369 cells within the budget. Hard: unique by search, down to 29%, then single cells too. Medium and hard
  are retried (up to 6 grids) until they need more than singles. Logic-solvable ⇒ unique, so every puzzle has exactly
  one solution. `generateSteps` yields between removals; the store runs it in ~24 ms slices (`startNew`) and the board shows "Se pregătește grila…" with progress.
  No Web Worker on purpose (a separate chunk would not be in the offline precache until first used).
- Game: `src/lib/game.ts` (pure): values (givens included), notes masks, hinted cells, clock. A digit clears that digit from
  the notes of every peer; the same digit again clears the cell. "Indiciu" (`findHint`) points at a wrong digit first
  (selected one first), else fills the selected empty cell, else the empty cell with the fewest candidates. Win = every
  cell equals the solution; a full grid with a mistake only gets a toast.
- Mistakes (menu "Cifre greșite"): `conflicts` (default, red only when the digit repeats in a unit) or `solution` (red when
  it differs from the solution).
- UI: `src/components/Sudoku.tsx` + `Board.tsx` (one SVG, 10 units per cell, `vector-effect: non-scaling-stroke` lines:
  thick on region borders and the outer edge). Pad below the board (portrait) or beside it (`landscape:`): digits 1-9 with
  how many are still missing (a digit written too often: red ring and a red "−n", not dimmed like a finished one), "Notițe", "Șterge", "Toate notițele", and "Mărește / Toată grila" on a Samurai whose cells
  are smaller than 42 px. On a phone (cells < 26 px) a tap on the Samurai zooms in to 42 px cells and scrolls to the
  cell (the board area scrolls natively, `touch-action: pan-x pan-y`).
- New game: dialog "Sudoku nou" (type + level, warns when a game in progress would be lost), opened by itself on a first
  visit. Win: a golden wave over the grid (`.wave`, `waveMs`), a tap skips it, then the result ("Încă unul la fel" /
  "Alt tip"); `celebrated` stops a replay after a reload; `resultClosed` (optional, missing = not closed) keeps the result closed after ×. Stats per `variant:level` (played at the first digit or note,
  won, best time).
- Store: `src/lib/store.ts`, module-level store for `useSyncExternalStore` (no setState in effects), saved on every change.
  `?seed=N&type=classic|samurai|tree&level=easy|medium|hard` generates a fixed puzzle (tests); removed from the URL at once.

## PWA, offline and the update button
Same as Classic Solitaire: `manifest.ts` (`id` `/classicsudoku/`, `scope`/`start_url` `/classicsudoku`, `short_name`
"Sudoku"), `src/app/sw.js/route.ts` (cache `sudoku-<version>`, precache of the page and its `/_next/static` files,
network-first pages with a 4 s fallback, `/api` never cached, header `Service-Worker-Allowed: /classicsudoku`),
`UpdateButton.tsx` (compares `GET /classicsudoku/api/version` with the bundled version, `SKIP_WAITING` + reload),
`src/lib/pwa.ts` (`beforeinstallprompt` → "📲 Instalează pe telefon"). Icon: `src/lib/pwa-icon.tsx` (3×3 sudoku box).

## Testing (GitHub Actions, manual only)
All checks run in GitHub Actions on the free tier (public repo, `ubuntu-latest` only), never locally (user's rule,
`D:\_DEv\CLAUDE.md`). Every workflow is `workflow_dispatch` only.
| Workflow | Runs |
| --- | --- |
| `check.yml` "Check code" | `npx next typegen` + `npx tsc --noEmit`, `npx eslint src`, `npx next build` (every step runs) |
| `unit-tests.yml` "Unit tests" | `npm test` (Vitest): geometry of the 3 boards, solver and logic grading, generator (all 9 type×level pairs: unique, level, givens, time logged), game rules, store (in memory), feedback validation |
| `e2e.yml` "E2E" | `node scripts/e2e.mjs <base_url>`: page, version in the client JS, `/api/version`, manifest, icons, `sw.js` headers, feedback validation (400s and the honeypot, nothing stored), fra1, 404 |
| `e2e-ui.yml` "E2E UI (Playwright)" | `tests/ui/*.e2e.ts` on desktop Chromium and Pixel 7: first-visit dialog, a classic easy played to the win with the pad, notes/erase/undo/clashes, hint, reload, Samurai shared box, menu settings and stats, new-game warning; desktop: manifest + `sw.js`, offline reload, update button, keyboard; phone: fits the screen, Samurai zoom, landscape |

- E2E and E2E UI need the deploy of the version under test to be live (run them on `main` after Vercel finished).
  No database in any workflow, so **no repo secrets** and no `concurrency: e2e` group (same decision as Classic Solitaire,
  2026-11-21).
- Playwright files are `*.e2e.ts`, never `*.spec.ts` / `*.test.ts` (Vitest would pick those up).
- UI tests use `data-cell` / `data-value` / `data-given` / `data-notes` / `data-shade` on the cells and `data-testid`:
  `board`, `grid` (with `data-variant`), `game-label`, `time`, `generating`, `welcome-new`, `digit-1`..`digit-9` (with `data-left`), `digit-<d>-left`, `notes`,
  `erase`, `fill-notes`, `zoom`, `new-game`, `undo`, `hint`, `menu-open`, `menu`, `setting-mistakes`, `setting-timer`,
  `stats`, `stat-<variant>-<level>`, `app-version`, `newgame-dialog`, `variant-<v>`, `level-<l>`, `newgame-warning`,
  `start-game`, `toast`, `win-wave`, `win-dialog`, `win-time`, `win-hints`, `win-new-game`, `win-other`, `update-reload`,
  `install`. Renaming one breaks `tests/ui`.
- Dev server (only if the user asks): `npm run dev -- -p 3013`.

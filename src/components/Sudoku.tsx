"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import { formatTime } from "@/lib/format";
import { conflicts, findHint, isFull, isGiven, remaining, wrongCells } from "@/lib/game";
import { LEVEL_NAMES, type Level } from "@/lib/generate";
import { geometry, VARIANT_NAMES, type Variant } from "@/lib/geometry";
import { canInstall, canInstallServer, promptInstall, subscribeInstall } from "@/lib/pwa";
import { actions, getServerSnapshot, getSnapshot, statsKey, subscribe } from "@/lib/store";
import { Board, waveMs, type CellLook } from "./Board";
import { Menu } from "./Menu";
import { NewGameDialog } from "./NewGameDialog";
import { UpdateButton } from "./UpdateButton";
import { btnPrimary, btnSecondary, Modal } from "./ui";

const SHORT: Record<Variant, string> = { classic: "Clasic", samurai: "Samurai", tree: "Brad" };
/** Space around the grid inside the board area. */
const PAD = 8;
/** Largest cell (big desktop screens). */
const MAX_CELL = 64;
/** Cell size of a zoomed-in Samurai. */
const ZOOM_CELL = 42;
/** A tap on a Samurai whose cells are smaller than this zooms in first (phones). */
const AUTO_ZOOM_BELOW = 26;

const SEL = "rgba(37, 99, 235, 0.38)";
const SAME = "rgba(37, 99, 235, 0.22)";
const PEER = "rgba(37, 99, 235, 0.09)";
const ERR_BG = "rgba(220, 38, 38, 0.16)";
const FLASH = "rgba(250, 204, 21, 0.7)";

export function Sudoku() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const installable = useSyncExternalStore(subscribeInstall, canInstall, canInstallServer);
  const areaRef = useRef<HTMLElement>(null);
  const centerOn = useRef<number | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<{ key: string; pos: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flashPos, setFlashPos] = useState<number | null>(null);

  const game = snap?.game ?? null;
  const generating = snap?.generating ?? null;
  const settings = snap?.settings ?? null;
  const geo = game ? geometry(game.variant) : null;
  const gameKey = game ? `${game.variant}:${game.level}:${game.seed}` : "";
  const selected = sel && sel.key === gameKey ? sel.pos : null;
  const celebrating = !!game && game.won && !game.celebrated;

  // Board area size.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setArea((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit =
    geo && area
      ? Math.max(8, Math.min(MAX_CELL, Math.floor(Math.min((area.w - 2 * PAD) / geo.width, (area.h - 2 * PAD) / geo.height))))
      : 0;
  const zoomable = geo?.variant === "samurai" && fit < ZOOM_CELL;
  const cellPx = zoomable && zoomed ? ZOOM_CELL : fit;
  const contentW = geo ? geo.width * cellPx + 2 * PAD : 0;
  const contentH = geo ? geo.height * cellPx + 2 * PAD : 0;
  const wrapW = Math.max(contentW, area?.w ?? 0);
  const wrapH = Math.max(contentH, area?.h ?? 0);

  // Keep the cell we zoomed to (or the hint) in the middle of the board area.
  useLayoutEffect(() => {
    const el = areaRef.current;
    const p = centerOn.current;
    if (!el || p === null || !geo) return;
    centerOn.current = null;
    const x = (wrapW - contentW) / 2 + PAD + ((p % geo.width) + 0.5) * cellPx;
    const y = (wrapH - contentH) / 2 + PAD + (Math.floor(p / geo.width) + 0.5) * cellPx;
    el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2 });
  });

  // Clock: runs while the game is started, not won and the app is on screen.
  const running = !!game && game.started && !game.won;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") actions.tick(now - last);
      last = now;
    }, 1000);
    const onVisible = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running]);

  // Win wave, then the result dialog.
  useEffect(() => {
    if (!celebrating || !geo) return;
    const id = window.setTimeout(() => actions.markCelebrated(), waveMs(geo));
    return () => window.clearTimeout(id);
  }, [celebrating, geo]);

  function flash(message: string, pos: number | null = null) {
    setToast(message);
    setFlashPos(pos);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      setFlashPos(null);
    }, 2600);
  }

  function select(p: number) {
    setSel({ key: gameKey, pos: p });
  }

  /** Show cell p: zoom a small Samurai in and scroll to it. */
  function reveal(p: number) {
    if (zoomable && !zoomed) setZoomed(true);
    centerOn.current = p;
  }

  function input(d: number) {
    if (!game || game.won) return;
    if (selected === null) return flash("Atinge întâi o căsuță din grilă.");
    if (isGiven(game, selected)) return flash("Cifrele date nu se pot schimba.");
    if (notesMode) {
      if (game.values[selected] !== 0) return flash("Căsuța are deja o cifră. Șterge-o ca să pui notițe.");
      actions.note(selected, d);
      return;
    }
    actions.digit(selected, d);
    const g = getSnapshot().game;
    if (g && !g.won && isFull(g)) flash("Grila e plină, dar ceva nu se potrivește. Caută cifrele greșite.");
  }

  function eraseSelected() {
    if (!game || game.won || selected === null) return;
    if (isGiven(game, selected)) return flash("Cifrele date nu se pot schimba.");
    actions.erase(selected);
  }

  function showHint() {
    if (!game || game.won) return;
    const h = findHint(game, selected);
    if (!h) return;
    select(h.pos);
    reveal(h.pos);
    if (h.kind === "wrong") {
      flash("Cifra din căsuța marcată e greșită.", h.pos);
    } else {
      actions.hint(h.pos);
      flash("Am completat căsuța marcată.", h.pos);
    }
  }

  function openNew() {
    setMenuOpen(false);
    setNewOpen(true);
  }

  function start(v: Variant, l: Level) {
    setNewOpen(false);
    setNotesMode(false);
    setZoomed(false);
    setSel(null);
    actions.startNew(v, l);
  }

  function fillAllNotes() {
    setMenuOpen(false);
    if (actions.fillNotes()) flash("Am pus în fiecare căsuță goală cifrele încă posibile.");
  }

  function onGridClick(e: ReactMouseEvent) {
    if (celebrating) {
      actions.markCelebrated();
      return;
    }
    const el = (e.target as Element).closest("[data-cell]");
    if (!el || !game) return;
    const p = Number(el.getAttribute("data-cell"));
    if (zoomable && !zoomed && fit < AUTO_ZOOM_BELOW) reveal(p);
    select(p);
  }

  function moveSelection(dr: number, dc: number) {
    if (!geo) return;
    let p = selected ?? geo.cells[0];
    let r = Math.floor(p / geo.width);
    let c = p % geo.width;
    for (;;) {
      r += dr;
      c += dc;
      if (r < 0 || c < 0 || r >= geo.height || c >= geo.width) return;
      p = r * geo.width + c;
      if (geo.active[p]) break;
    }
    select(p);
    if (zoomable && zoomed) centerOn.current = p;
  }

  // Keyboard (desktop): 1-9, Backspace/Delete/0, arrows, N notes, Ctrl+Z undo, H hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=dialog]")) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") {
        e.preventDefault();
        actions.undo();
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      } else if (/^[1-9]$/.test(k)) {
        input(Number(k));
      } else if (k === "Backspace" || k === "Delete" || k === "0") {
        eraseSelected();
      } else if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
        e.preventDefault();
        moveSelection(k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0, k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0);
      } else if (k.toLowerCase() === "n") {
        setNotesMode((m) => !m);
      } else if (k.toLowerCase() === "h") {
        showHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const looks = useMemo(() => {
    const m = new Map<number, CellLook>();
    if (!game || !geo || !settings) return m;
    const errors = settings.mistakes === "solution" ? new Set(wrongCells(game)) : conflicts(game);
    const selVal = selected !== null ? game.values[selected] : 0;
    const peers = selected !== null ? new Set(geo.peers[selected]) : null;
    const hinted = new Set(game.hinted);
    for (const p of geo.cells) {
      let overlay: string | undefined;
      if (p === flashPos) overlay = FLASH;
      else if (p === selected) overlay = SEL;
      else if (selVal && game.values[p] === selVal) overlay = SAME;
      else if (errors.has(p)) overlay = ERR_BG;
      else if (peers?.has(p)) overlay = PEER;
      const given = isGiven(game, p);
      const err = errors.has(p) && !given;
      if (!overlay && !err && !hinted.has(p)) continue;
      m.set(p, { overlay, ink: err ? "#dc2626" : given ? "#111827" : hinted.has(p) ? "#7e22ce" : "#1d4ed8", bold: false });
    }
    return m;
  }, [game, geo, settings, selected, flashPos]);

  const givenOf = useMemo(() => (game ? (p: number) => isGiven(game, p) : () => false), [game]);
  const left = game ? remaining(game) : null;
  const showWelcome = !game && !generating;
  const dialogOpen = newOpen || (showWelcome && !welcomeClosed && !!snap);
  const stats = game && snap ? snap.stats[statsKey(game.variant, game.level)] : undefined;

  return (
    <div className="flex h-full flex-col" style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <header
        className="flex min-h-11 shrink-0 items-center gap-3 bg-black/25 px-3 text-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="font-bold tracking-wide">Classic Sudoku</span>
        {game && (
          <span className="truncate text-white/80" data-testid="game-label">
            {SHORT[game.variant]} · {LEVEL_NAMES[game.level]}
          </span>
        )}
        <span className="flex-1" />
        {game && settings?.timer && (
          <span className="tabular-nums" data-testid="time">
            Timp: <b>{formatTime(game.elapsedMs)}</b>
          </span>
        )}
      </header>

      {/* Update / install buttons get their own strip (the board shrinks), so they never cover the grid. */}
      <div className="flex shrink-0 flex-wrap justify-center gap-2 px-2 py-1.5 empty:hidden">
        <UpdateButton />
        {installable && (
          <button
            type="button"
            data-testid="install"
            onClick={() => void promptInstall()}
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-green-900 shadow-md"
          >
            📲 Instalează pe telefon
          </button>
        )}
      </div>

      {toast && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[5600] flex justify-center px-3"
          style={{ top: "calc(env(safe-area-inset-top) + 3.25rem)" }}
        >
          <p role="status" data-testid="toast" className="rounded-full bg-black/80 px-4 py-2 text-center text-sm font-semibold">
            {toast}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main
          ref={areaRef}
          data-testid="board"
          className="relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
          style={{ touchAction: "pan-x pan-y" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {game && geo && cellPx > 0 && !generating && (
            <div className="flex items-center justify-center" style={{ width: wrapW, height: wrapH }} onClick={onGridClick}>
              <div className="rounded-sm shadow-lg" style={{ padding: 0, margin: PAD }}>
                <Board
                  geo={geo}
                  values={game.values}
                  notes={game.notes}
                  given={givenOf}
                  looks={looks}
                  cellPx={cellPx}
                  celebrating={celebrating}
                />
              </div>
            </div>
          )}
          {generating && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" data-testid="generating">
              <p className="text-lg font-semibold">Se pregătește grila…</p>
              <p className="text-sm text-white/80">
                {VARIANT_NAMES[generating.variant]}, {LEVEL_NAMES[generating.level].toLowerCase()}
              </p>
              <div className="h-2 w-56 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-yellow-300 transition-[width]" style={{ width: `${Math.round(generating.progress * 100)}%` }} />
              </div>
            </div>
          )}
          {showWelcome && snap && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="text-lg font-semibold">Alege un sudoku: clasic, Samurai sau Bradul de Crăciun.</p>
              <button type="button" className={`${btnPrimary} bg-white text-green-900 hover:bg-zinc-100`} onClick={openNew} data-testid="welcome-new">
                Alege jocul
              </button>
            </div>
          )}
        </main>

        {game && left && !generating && (
          <section className="shrink-0 bg-black/15 px-2 py-1.5 landscape:flex landscape:w-60 landscape:flex-col landscape:justify-center" aria-label="Cifre">
            <div className="grid grid-cols-9 gap-1 landscape:grid-cols-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  type="button"
                  data-testid={`digit-${d}`}
                  onClick={() => input(d)}
                  disabled={game.won}
                  aria-label={notesMode ? `Notiță ${d}` : `Cifra ${d}`}
                  className={`relative flex min-h-12 items-center justify-center rounded-lg font-bold shadow-sm active:brightness-90 disabled:opacity-40 ${
                    notesMode ? "bg-amber-100 text-xl text-amber-900" : "bg-white text-2xl text-green-950"
                  } ${left[d] <= 0 ? "opacity-40" : ""}`}
                >
                  {d}
                  <span className="absolute right-1 bottom-0.5 text-[10px] font-semibold text-zinc-500" aria-hidden>
                    {left[d] > 0 ? left[d] : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className={`mt-1.5 grid gap-1 ${zoomable ? "grid-cols-4" : "grid-cols-3"} landscape:grid-cols-2`}>
              <ToolButton testId="notes" icon="✏️" label={notesMode ? "Notițe: DA" : "Notițe: nu"} pressed={notesMode} onClick={() => setNotesMode((m) => !m)} />
              <ToolButton testId="erase" icon="⌫" label="Șterge" onClick={eraseSelected} />
              <ToolButton testId="fill-notes" icon="📝" label="Toate notițele" onClick={fillAllNotes} />
              {zoomable && (
                <ToolButton
                  testId="zoom"
                  icon={zoomed ? "🔎" : "🔍"}
                  label={zoomed ? "Toată grila" : "Mărește"}
                  pressed={zoomed}
                  onClick={() => {
                    if (!zoomed) centerOn.current = selected ?? geo!.cells[Math.floor(geo!.cells.length / 2)];
                    setZoomed(!zoomed);
                  }}
                />
              )}
            </div>
          </section>
        )}
      </div>

      <nav
        className="grid shrink-0 grid-cols-4 gap-1.5 bg-black/25 px-2 pt-1.5"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        <BarButton testId="new-game" icon="🔢" label="Joc nou" onClick={openNew} />
        <BarButton testId="undo" icon="↶" label="Înapoi" onClick={() => actions.undo()} disabled={!snap?.canUndo} />
        <BarButton testId="hint" icon="💡" label="Indiciu" onClick={showHint} disabled={!game || game.won || !!generating} />
        <BarButton testId="menu-open" icon="☰" label="Meniu" onClick={() => setMenuOpen(true)} />
      </nav>

      {menuOpen && snap && (
        <Menu settings={snap.settings} stats={snap.stats} onClose={() => setMenuOpen(false)} />
      )}

      {dialogOpen && snap && (
        <NewGameDialog
          variant={snap.settings.variant}
          level={snap.settings.level}
          warn={!!game && game.started && !game.won}
          onStart={start}
          onClose={() => {
            setNewOpen(false);
            setWelcomeClosed(true);
          }}
        />
      )}

      {game && game.won && game.celebrated && !game.resultClosed && !dialogOpen && !menuOpen && !generating && (
        <Modal title="Felicitări! 🎉" onClose={() => actions.closeResult()} testId="win-dialog">
          <p className="mb-1 text-lg font-semibold">Ai rezolvat sudoku-ul!</p>
          <dl className="mb-4 grid grid-cols-2 gap-y-1 text-sm">
            <dt>Tipul</dt>
            <dd className="text-right font-semibold">
              {VARIANT_NAMES[game.variant]}, {LEVEL_NAMES[game.level].toLowerCase()}
            </dd>
            <dt>Timp</dt>
            <dd className="text-right font-semibold" data-testid="win-time">
              {formatTime(game.elapsedMs)}
            </dd>
            <dt>Indicii folosite</dt>
            <dd className="text-right font-semibold" data-testid="win-hints">
              {game.hints}
            </dd>
            {stats?.bestMs != null && (
              <>
                <dt>Cel mai bun timp</dt>
                <dd className="text-right font-semibold">{formatTime(stats.bestMs)}</dd>
              </>
            )}
            {stats && (
              <>
                <dt>Rezolvate până acum</dt>
                <dd className="text-right font-semibold">
                  {stats.won} din {stats.played}
                </dd>
              </>
            )}
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnSecondary} onClick={openNew} data-testid="win-other">
              Alt tip
            </button>
            <button type="button" className={btnPrimary} onClick={() => start(game.variant, game.level)} data-testid="win-new-game">
              Încă unul la fel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  pressed,
  testId,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold leading-tight ${
        pressed ? "bg-amber-300 text-amber-950" : "bg-white/15 active:bg-white/30"
      }`}
    >
      <span className="text-base leading-none" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function BarButton({
  icon,
  label,
  onClick,
  disabled,
  testId,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white/10 px-1 text-xs font-semibold leading-tight active:bg-white/25 disabled:opacity-40"
    >
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

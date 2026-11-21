"use client";

import { memo, useMemo } from "react";
import type { Geometry } from "@/lib/geometry";

/** SVG units per cell. */
const U = 10;

const SHADE_FILL = ["#ffffff", "#d8f0d4", "#eadbc8", "#fff1a8"];

export type CellLook = {
  /** Background overlay (selection, peers, same digit, error, hint flash). */
  overlay?: string;
  /** Digit colour. */
  ink: string;
  bold: boolean;
};

/** Thin and thick line paths of a board: thick around regions and along the outer edge. Computed once per variant. */
function linePaths(g: Geometry): { thin: string; thick: string } {
  const thin: string[] = [];
  const thick: string[] = [];
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < g.height && c < g.width && g.active[r * g.width + c];
  for (const p of g.cells) {
    const r = Math.floor(p / g.width);
    const c = p % g.width;
    const x = c * U;
    const y = r * U;
    const top = `M${x} ${y}h${U}`;
    const left = `M${x} ${y}v${U}`;
    (on(r - 1, c) && g.region[p - g.width] === g.region[p] ? thin : thick).push(top);
    (on(r, c - 1) && g.region[p - 1] === g.region[p] ? thin : thick).push(left);
    if (!on(r + 1, c)) thick.push(`M${x} ${y + U}h${U}`);
    if (!on(r, c + 1)) thick.push(`M${x + U} ${y}v${U}`);
  }
  return { thin: thin.join(""), thick: thick.join("") };
}

const pathCache = new WeakMap<Geometry, { thin: string; thick: string }>();

export const Board = memo(function Board({
  geo,
  values,
  notes,
  given,
  looks,
  cellPx,
  celebrating,
}: {
  geo: Geometry;
  values: number[];
  notes: number[];
  given: (p: number) => boolean;
  looks: Map<number, CellLook>;
  cellPx: number;
  celebrating: boolean;
}) {
  const lines = useMemo(() => {
    let l = pathCache.get(geo);
    if (!l) {
      l = linePaths(geo);
      pathCache.set(geo, l);
    }
    return l;
  }, [geo]);
  const W = geo.width * U;
  const H = geo.height * U;

  return (
    <svg
      width={geo.width * cellPx}
      height={geo.height * cellPx}
      viewBox={`0 0 ${W} ${H}`}
      data-testid="grid"
      data-variant={geo.variant}
      className="block"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }}
    >
      {geo.cells.map((p) => {
        const r = Math.floor(p / geo.width);
        const c = p % geo.width;
        const x = c * U;
        const y = r * U;
        const v = values[p];
        const look = looks.get(p);
        const isGiven = given(p);
        return (
          <g
            key={p}
            data-cell={p}
            data-value={v}
            data-given={isGiven ? "1" : "0"}
            data-shade={geo.shade[p] || undefined}
            data-notes={!v && notes[p] ? notes[p] : undefined}
            className="cursor-pointer"
          >
            <rect x={x} y={y} width={U} height={U} fill={SHADE_FILL[geo.shade[p]]} />
            {look?.overlay && <rect x={x} y={y} width={U} height={U} fill={look.overlay} />}
            {v ? (
              <text
                x={x + U / 2}
                y={y + U / 2 + 0.3}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7}
                fontWeight={isGiven || look?.bold ? 700 : 500}
                fill={look?.ink ?? (isGiven ? "#111827" : "#1d4ed8")}
              >
                {v}
              </text>
            ) : (
              notes[p] !== 0 &&
              Array.from({ length: 9 }, (_, k) =>
                notes[p] & (1 << k) ? (
                  <text
                    key={k}
                    x={x + 1.75 + (k % 3) * 3.25}
                    y={y + 1.9 + Math.floor(k / 3) * 3.15}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={2.7}
                    fill="#4b5563"
                  >
                    {k + 1}
                  </text>
                ) : null,
              )
            )}
          </g>
        );
      })}
      <path d={lines.thin} stroke="#a1a1aa" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" pointerEvents="none" />
      <path
        d={lines.thick}
        stroke="#1f2937"
        strokeWidth={cellPx >= 30 ? 2.5 : 2}
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
        fill="none"
        pointerEvents="none"
      />
      {celebrating && (
        <g data-testid="win-wave" pointerEvents="none">
          {geo.cells.map((p) => {
            const r = Math.floor(p / geo.width);
            const c = p % geo.width;
            return (
              <rect key={p} className="wave" x={c * U} y={r * U} width={U} height={U} style={{ animationDelay: `${(r + c) * 28}ms` }} />
            );
          })}
        </g>
      )}
    </svg>
  );
});

/** How long the win wave runs for a board (last cell's delay + the animation). */
export const waveMs = (g: Geometry) => (g.width + g.height - 2) * 28 + 800;

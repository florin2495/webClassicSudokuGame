"use client";

import { useState } from "react";
import { VARIANT_NAMES, VARIANTS, type Variant } from "@/lib/geometry";
import { LEVEL_NAMES, LEVELS, type Level } from "@/lib/generate";
import { btnPrimary, Modal } from "./ui";

const VARIANT_TEXT: Record<Variant, string> = {
  classic: "Grila obișnuită: fiecare rând, coloană și pătrat de 3×3 are cifrele 1-9 o singură dată.",
  samurai: "Cinci grile 9×9 legate prin colțuri. Pătratul comun trebuie să se potrivească în ambele grile.",
  tree: "Grilă 9×9 cu bucăți neregulate în loc de pătrate. Bradul e format din trei bucăți de câte 9 căsuțe.",
};

const LEVEL_TEXT: Record<Level, string> = {
  easy: "Multe cifre date, se rezolvă căutând locul unic al fiecărei cifre.",
  medium: "Mai puține cifre; uneori ajută notițele și perechile.",
  hard: "Puține cifre; ai nevoie de notițe și de răbdare.",
};

/** Small drawing of each board shape. */
function VariantIcon({ variant }: { variant: Variant }) {
  const stroke = { stroke: "#1f2937", strokeWidth: 1.6, fill: "#fff" };
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="shrink-0">
      {variant === "classic" && (
        <>
          <rect x="4" y="4" width="36" height="36" {...stroke} />
          <path d="M16 4v36M28 4v36M4 16h36M4 28h36" stroke="#1f2937" strokeWidth="1" />
        </>
      )}
      {variant === "samurai" && (
        <>
          <rect x="2" y="2" width="16" height="16" {...stroke} />
          <rect x="26" y="2" width="16" height="16" {...stroke} />
          <rect x="2" y="26" width="16" height="16" {...stroke} />
          <rect x="26" y="26" width="16" height="16" {...stroke} />
          <rect x="14" y="14" width="16" height="16" {...stroke} fill="#e0ecff" />
        </>
      )}
      {variant === "tree" && (
        <>
          <rect x="4" y="4" width="36" height="36" {...stroke} />
          <path d="M22 7 L31 22 L27 22 L34 33 L10 33 L17 22 L13 22 Z" fill="#7cc576" stroke="#166534" strokeWidth="1" />
          <rect x="20" y="33" width="4" height="6" fill="#a47148" />
        </>
      )}
    </svg>
  );
}

export function NewGameDialog({
  variant: initialVariant,
  level: initialLevel,
  warn,
  onStart,
  onClose,
}: {
  variant: Variant;
  level: Level;
  /** A game is in progress and would be lost. */
  warn: boolean;
  onStart: (v: Variant, l: Level) => void;
  onClose: () => void;
}) {
  const [variant, setVariant] = useState(initialVariant);
  const [level, setLevel] = useState(initialLevel);

  return (
    <Modal title="Sudoku nou" onClose={onClose} testId="newgame-dialog">
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-zinc-600">Tipul de sudoku</legend>
          {VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`variant-${v}`}
              aria-pressed={v === variant}
              onClick={() => setVariant(v)}
              className={`flex items-center gap-3 rounded-xl border p-2 text-left ${
                v === variant ? "border-green-700 bg-green-50 ring-2 ring-green-700" : "border-zinc-300 bg-white hover:bg-zinc-50"
              }`}
            >
              <VariantIcon variant={v} />
              <span className="flex flex-col">
                <span className="font-bold">{VARIANT_NAMES[v]}</span>
                <span className="text-xs text-zinc-600">{VARIANT_TEXT[v]}</span>
              </span>
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold text-zinc-600">Dificultatea</legend>
          <div className="flex gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                data-testid={`level-${l}`}
                aria-pressed={l === level}
                onClick={() => setLevel(l)}
                className={`min-h-11 flex-1 rounded-lg border px-2 text-sm font-semibold ${
                  l === level ? "border-green-700 bg-green-700 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                {LEVEL_NAMES[l]}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-600">{LEVEL_TEXT[level]}</p>
        </fieldset>

        {warn && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900" data-testid="newgame-warning">
            Jocul de acum nu e terminat. Dacă începi altul, el se pierde.
          </p>
        )}

        <button type="button" className={btnPrimary} onClick={() => onStart(variant, level)} data-testid="start-game">
          Începe: {VARIANT_NAMES[variant]}, {LEVEL_NAMES[level].toLowerCase()}
        </button>
      </div>
    </Modal>
  );
}

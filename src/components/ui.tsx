"use client";

import type { ReactNode } from "react";

/** Full-screen dimmed overlay with a centred panel. A tap outside the panel closes it. */
export function Modal({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="fixed inset-0 z-[6000] overflow-y-auto overscroll-contain bg-black/55">
      <div
        className="flex min-h-full items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-testid={testId}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          className="w-full max-w-md rounded-2xl bg-white p-4 text-zinc-900 shadow-2xl select-text"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-zinc-500 hover:bg-zinc-100"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Choice<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" data-testid={testId}>
      <legend className="mb-1 text-sm font-semibold text-zinc-600">{label}</legend>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-lg border px-2 text-sm font-semibold ${
              o.value === value ? "border-green-700 bg-green-700 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const btn = "min-h-11 rounded-lg px-4 font-semibold";
export const btnPrimary = `${btn} bg-green-700 text-white hover:bg-green-600 disabled:opacity-50`;
export const btnSecondary = `${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`;

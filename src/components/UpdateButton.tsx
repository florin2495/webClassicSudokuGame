"use client";

import { useEffect, useState } from "react";
import { APP_VERSION, BASE_PATH } from "@/lib/pwa";

/** How often an open game asks for the live version (also on every return to the app). */
const CHECK_MS = 5 * 60_000;

/**
 * Registers the service worker (offline play) and shows a separate "Versiune nouă" reload button when a newer
 * version is live: either /api/version answers another version than this page was built with, or a new service
 * worker has been installed and is waiting. The game is saved on the device, so reloading loses nothing.
 */
export function UpdateButton() {
  const [latest, setLatest] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let stopped = false;
    let reg: ServiceWorkerRegistration | null = null;

    if ("serviceWorker" in navigator) {
      const watch = (r: ServiceWorkerRegistration) => {
        if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const w = r.installing;
          w?.addEventListener("statechange", () => {
            if (!stopped && w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
          });
        });
      };
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: BASE_PATH })
        .then((r) => {
          reg = r;
          if (!stopped) watch(r);
        })
        .catch(() => undefined);
    }

    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      reg?.update().catch(() => undefined);
      try {
        const res = await fetch(`${BASE_PATH}/api/version`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: unknown };
        if (!stopped && typeof version === "string" && version !== APP_VERSION) setLatest(version);
      } catch {
        // offline or the deploy is switching over: try again later
      }
    };
    void check();
    const timer = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  if (!latest && !waiting) return null;

  const reload = () => {
    if (waiting && "serviceWorker" in navigator) {
      // Let the new worker take over first, then reload into the new version.
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 2500);
    } else {
      window.location.reload();
    }
  };

  return (
    <button
      type="button"
      data-testid="update-reload"
      onClick={reload}
      className="flex min-h-9 items-center gap-1.5 rounded-full bg-yellow-300 px-3 text-sm font-bold text-green-950 shadow-md ring-2 ring-yellow-100 active:bg-yellow-200"
    >
      🔄 Versiune nouă{latest ? ` (v${latest})` : ""} – Reîncarcă
    </button>
  );
}

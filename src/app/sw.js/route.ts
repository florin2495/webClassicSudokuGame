import { connection } from "next/server";
import pkg from "../../../package.json";

const BASE = "/classicsudoku";

// GET /classicsudoku/sw.js - the service worker. Its text contains the app version, so every deploy (version bump)
// is a new worker: the browser installs it in the background and the page shows "Versiune nouă" (UpdateButton).
// Offline: the page is cached on install (with every /_next/static file it references), pages are network-first
// with a 4 s fallback to the cache, hashed /_next/static files are cache-first, /api is never cached.
// Scope is "/classicsudoku" (no trailing slash, the URL of the page), hence the Service-Worker-Allowed header.
const source = `
const VERSION = ${JSON.stringify(pkg.version)};
const BASE = ${JSON.stringify(BASE)};
const CACHE = "sudoku-" + VERSION;
const ASSET_RE = /\\/classicsudoku\\/_next\\/static\\/[A-Za-z0-9_\\-.\\/~%@]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(BASE, { cache: "no-store" });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(BASE, res);
  const urls = new Set(html.match(ASSET_RE) || []);
  urls.add(BASE + "/manifest.webmanifest");
  urls.add(BASE + "/pwa-icons/192");
  urls.add(BASE + "/pwa-icons/512");
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("sudoku-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

async function page(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(BASE, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  const first = await Promise.race([network, timeout(4000)]);
  if (first) return first;
  const cached = await cache.match(BASE);
  if (cached) return cached;
  const late = await network;
  return late || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

async function other(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(BASE + "/")) return;
  if (url.pathname.startsWith(BASE + "/api/") || url.pathname === BASE + "/sw.js") return;
  if (request.mode === "navigate") {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith(BASE + "/_next/static/")) {
    event.respondWith(asset(request));
  } else if (!url.search.includes("_rsc")) {
    event.respondWith(other(request));
  }
});
`;

export async function GET() {
  await connection(); // request-time: never a stale prerendered copy
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": BASE,
    },
  });
}

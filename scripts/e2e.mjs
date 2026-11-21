// HTTP end-to-end check of the deployed Classic Sudoku (no browser, Node built-ins only).
// Usage: node scripts/e2e.mjs [baseUrl incl. /classicsudoku] [vercelProjectUrl incl. /classicsudoku]
// Default: production (https://games.hailatat.icu/classicsudoku). Writes nothing: the only POSTs to /api/feedback are
// an invalid message (400) and a honeypot one (accepted but never stored).
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "https://games.hailatat.icu/classicsudoku").replace(/\/+$/, "");
const VERCEL = process.argv[3] ?? null;
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const path = new URL(BASE).pathname; // "/classicsudoku"
let failures = 0;

function check(cond, msg) {
  if (cond) console.log("  ✓", msg);
  else {
    failures++;
    console.log("  ✗", msg);
  }
}

async function get(url, init) {
  const res = await fetch(url, { redirect: "follow", headers: { "cache-control": "no-cache" }, ...init });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

console.log(`Classic Sudoku E2E against ${BASE} (package.json ${version})`);

// Page and assets.
const page = await get(BASE);
check(page.status === 200 && (page.headers.get("content-type") ?? "").includes("text/html"), `page -> ${page.status}`);
check(page.text.includes(`${path}/_next/`), `assets under ${path}/_next/`);
check(page.text.includes(`${path}/manifest.webmanifest`), "links the manifest");
check(page.text.includes("<title>Classic Sudoku</title>"), "title Classic Sudoku");
const scripts = [...new Set([...page.text.matchAll(/src="([^"]+\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
check(scripts.length > 0, `${scripts.length} scripts`);
let versionInJs = false;
for (const s of scripts) {
  const r = await get(new URL(s, BASE).toString());
  if (r.status !== 200) check(false, `${s} -> ${r.status}`);
  if (r.text.includes(`"${version}"`)) versionInJs = true;
}
check(versionInJs, `client JS contains version ${version} (run after the Vercel deploy of this version)`);

// Live version (what the update button compares with) and region.
const v = await get(`${BASE}/api/version`);
let live = null;
try {
  live = JSON.parse(v.text).version;
} catch {}
check(v.status === 200 && live === version, `/api/version -> ${v.status} ${live}`);
check((v.headers.get("cache-control") ?? "").includes("no-store"), "/api/version is not cached");

// PWA: manifest, icons, service worker.
const m = await get(`${BASE}/manifest.webmanifest`);
let manifest = {};
try {
  manifest = JSON.parse(m.text);
} catch {}
check(m.status === 200, `manifest -> ${m.status}`);
check(manifest.id === "/classicsudoku/" && manifest.scope === "/classicsudoku" && manifest.start_url === "/classicsudoku", "manifest: own id, scope and start_url");
check(manifest.display === "standalone" && Array.isArray(manifest.icons) && manifest.icons.length === 3, "manifest: standalone, 3 icons");
for (const icon of manifest.icons ?? []) {
  const r = await fetch(new URL(icon.src, BASE));
  check(r.status === 200 && (r.headers.get("content-type") ?? "").includes("image/png"), `${icon.src} -> ${r.status}`);
}
const apple = await fetch(`${BASE}/pwa-icons/apple`);
check(apple.status === 200, `apple icon -> ${apple.status}`);
const sw = await get(`${BASE}/sw.js`);
check(sw.status === 200 && (sw.headers.get("content-type") ?? "").includes("javascript"), `sw.js -> ${sw.status}`);
check(sw.headers.get("service-worker-allowed") === "/classicsudoku", `sw.js Service-Worker-Allowed: ${sw.headers.get("service-worker-allowed")}`);
check(sw.text.includes(JSON.stringify(version)), "sw.js carries this version (a new deploy = a new worker)");

// Feedback validation (never stores anything).
const fb = async (body) => {
  const r = await fetch(`${BASE}/api/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, region: r.headers.get("x-vercel-id") ?? "" };
};
const empty = await fb({ message: "   " });
check(empty.status === 400, `empty feedback -> ${empty.status} (400 expected)`);
const tooLong = await fb({ message: "x".repeat(1001) });
check(tooLong.status === 400, `1001-char feedback -> ${tooLong.status} (400 expected)`);
const honeypot = await fb({ message: "e2e honeypot, not stored", website: "e2e" });
check(honeypot.status === 200, `honeypot feedback -> ${honeypot.status} (200, not stored)`);
check(empty.region.includes("fra1"), `functions run in fra1 (x-vercel-id ${empty.region})`);

// Unknown pages are a 404, not a crash.
const missing = await get(`${BASE}/nu-exista`);
check(missing.status === 404, `${path}/nu-exista -> ${missing.status}`);

// The Vercel project URL serves the same build.
if (VERCEL) {
  const direct = await get(`${VERCEL.replace(/\/+$/, "")}/api/version`);
  let dv = null;
  try {
    dv = JSON.parse(direct.text).version;
  } catch {}
  check(dv === version, `${VERCEL} serves ${dv}`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nE2E OK");
process.exit(failures ? 1 : 0);

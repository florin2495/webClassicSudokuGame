"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { formatTime } from "@/lib/format";
import { LEVEL_NAMES, LEVELS } from "@/lib/generate";
import { VARIANT_NAMES, VARIANTS } from "@/lib/geometry";
import { APP_VERSION, BASE_PATH, canInstall, canInstallServer, promptInstall, subscribeInstall } from "@/lib/pwa";
import { actions, statsKey, type Settings, type Stats } from "@/lib/store";
import { btnPrimary, btnSecondary, Choice, Modal } from "./ui";

const subscribeNothing = () => () => {};
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

export function Menu({
  settings,
  stats,
  onClose,
}: {
  settings: Settings;
  stats: Stats;
  onClose: () => void;
}) {
  const installable = useSyncExternalStore(subscribeInstall, canInstall, canInstallServer);
  const standalone = useSyncExternalStore(subscribeNothing, isStandalone, () => false);

  return (
    <Modal title="Meniu" onClose={onClose} testId="menu">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <Choice
            label="Cifre greșite (roșii)"
            testId="setting-mistakes"
            value={settings.mistakes}
            options={[
              { value: "conflicts", label: "Doar dublurile" },
              { value: "solution", label: "Imediat" },
            ]}
            onChange={(v) => actions.updateSettings({ mistakes: v })}
          />
          <p className="-mt-1 text-xs text-zinc-600">
            {settings.mistakes === "conflicts"
              ? "Roșu doar când aceeași cifră apare de două ori pe un rând, o coloană sau o bucată."
              : "Roșu orice cifră care nu e cea din soluție."}
          </p>
          <Choice
            label="Cronometru"
            testId="setting-timer"
            value={settings.timer}
            options={[
              { value: true, label: "Da" },
              { value: false, label: "Nu" },
            ]}
            onChange={(v) => actions.updateSettings({ timer: v })}
          />
        </section>

        <section data-testid="stats">
          <h3 className="mb-2 text-sm font-semibold text-zinc-600">Statistici (câștigate / începute, cel mai bun timp)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 font-semibold" />
                {LEVELS.map((l) => (
                  <th key={l} className="py-1 text-right font-semibold">
                    {LEVEL_NAMES[l]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v} className="border-t border-zinc-100">
                  <td className="py-1 pr-2 font-semibold">{VARIANT_NAMES[v]}</td>
                  {LEVELS.map((l) => {
                    const s = stats[statsKey(v, l)];
                    return (
                      <td key={l} className="py-1 text-right tabular-nums" data-testid={`stat-${v}-${l}`}>
                        {s ? `${s.won}/${s.played}` : "–"}
                        <br />
                        <span className="text-xs text-zinc-500">{s?.bestMs != null ? formatTime(s.bestMs) : ""}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="mt-2 text-xs font-semibold text-zinc-500 underline" onClick={() => actions.resetStats()}>
            Șterge statisticile
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-600">Aplicația pe telefon</h3>
          {standalone ? (
            <p className="text-sm">Jocul rulează ca aplicație instalată ✓. Merge și fără internet.</p>
          ) : installable ? (
            <button type="button" className={btnPrimary} onClick={() => void promptInstall()} data-testid="menu-install">
              📲 Instalează Classic Sudoku pe telefon
            </button>
          ) : (
            <p className="text-sm text-zinc-700">
              În Chrome: apasă meniul <b>⋮</b> (sus, dreapta), apoi <b>Instalează aplicația</b> sau <b>Adaugă pe ecranul
              de pornire</b>. Pe iPhone (Safari): butonul <b>Partajează</b>, apoi <b>Adaugă pe ecranul principal</b>.
            </p>
          )}
        </section>

        <details className="rounded-lg bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Cum se joacă</summary>
          <div className="mt-2 flex flex-col gap-2 text-zinc-700">
            <p>
              Completezi căsuțele goale cu cifre de la 1 la 9. Fiecare rând, fiecare coloană și fiecare bucată încadrată cu
              linie groasă trebuie să aibă toate cifrele 1-9, fiecare o singură dată. Fiecare sudoku are o singură soluție.
            </p>
            <p>
              <b>Clasic 9×9:</b> bucățile sunt cele 9 pătrate de 3×3.
            </p>
            <p>
              <b>Samurai:</b> cinci grile 9×9; cea din mijloc are în fiecare colț un pătrat comun cu una dintre grilele din
              colțuri. Rândurile și coloanele merg doar în grila lor, de 9 căsuțe, iar pătratul comun trebuie să se potrivească
              în ambele grile. Atinge grila ca s-o mărești, „🔎 Toată grila” o arată din nou întreagă.
            </p>
            <p>
              <b>Bradul de Crăciun:</b> în loc de pătrate, grila are 9 bucăți neregulate de câte 9 căsuțe (urmează liniile
              groase). Bradul verde e format din trei dintre ele: vârful, mijlocul și baza cu trunchiul.
            </p>
            <p>
              Atinge o căsuță, apoi o cifră de jos. Aceeași cifră încă o dată o șterge. Cu <b>„✏️ Notițe”</b> pornit, cifrele
              se scriu mic, ca variante. „📝 Toate notițele” le pune pe toate cele încă posibile. Când pui o cifră, ea dispare
              singură din notițele vecinilor.
            </p>
            <p>„Înapoi” anulează ultima mutare. „Indiciu” arată o cifră greșită sau completează o căsuță. Jocul se salvează singur.</p>
            <p>Pe calculator: cifrele 1-9, Backspace pentru ștergere, săgețile, N pentru notițe, Ctrl+Z pentru înapoi, H pentru indiciu.</p>
          </div>
        </details>

        <FeedbackForm />

        <div className="flex items-center justify-between text-sm">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="font-semibold text-green-800 underline">
            ← Toate jocurile
          </a>
          <span className="text-zinc-500" data-testid="app-version">
            Versiunea {APP_VERSION}
          </span>
        </div>
      </div>
    </Modal>
  );
}

function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${BASE_PATH}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Nu am putut trimite mesajul. Încearcă din nou.");
      }
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut trimite mesajul. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-lg bg-zinc-50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">💬 Trimite o părere</summary>
      {sent ? (
        <p role="status" className="py-4 text-center font-semibold">
          Mulțumim! Mesajul a ajuns.
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-2 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            required
            aria-label="Mesaj"
            placeholder="Ce problemă ai găsit sau ce am putea îmbunătăți?"
            className="rounded-lg border border-zinc-300 bg-white p-2 text-base"
          />
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
          <button type="submit" className={btnSecondary} disabled={busy || message.trim().length === 0}>
            {busy ? "Se trimite…" : "Trimite"}
          </button>
        </form>
      )}
    </details>
  );
}

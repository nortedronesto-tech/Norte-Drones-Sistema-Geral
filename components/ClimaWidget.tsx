"use client";

import { useState } from "react";
import { CloudSun, LocateFixed } from "lucide-react";
import { DEFAULT_PLACE, evaluateClima, LEVEL_LABEL, openMeteoUrl, parseOpenMeteo, type ClimaInput, type Level } from "@/lib/clima";
import { btn } from "./ui";

const TONE: Record<Level, { dot: string; box: string }> = {
  bom: { dot: "bg-brand-green", box: "border-brand-green/40 bg-brand-green/[0.07]" },
  atencao: { dot: "bg-brand-amber", box: "border-brand-amber/50 bg-brand-amber/10" },
  nao: { dot: "bg-danger", box: "border-danger/40 bg-danger/[0.06]" },
};
const LS_POS = "norte:lastpos";

/** Semáforo a partir de números já conhecidos (digitados ou vindos da previsão). */
export function ClimaSemaforo({ input, place }: { input: ClimaInput; place?: string }) {
  const r = evaluateClima(input);
  if (r.factors.length === 0) return null;
  const t = TONE[r.level];
  return (
    <div className={`rounded-xl border p-3 ${t.box}`} role="status">
      <p className="flex items-center gap-2 text-base font-extrabold text-brand-dark">
        <span className={`inline-block size-4 rounded-full ${t.dot}`} aria-hidden /> {LEVEL_LABEL[r.level]}
        {place && <span className="text-xs font-medium text-brand-graphite/60">· {place}</span>}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {r.factors.map((f) => (
          <li key={f.id} className="flex gap-2"><span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${TONE[f.level].dot}`} aria-hidden /> {f.text}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-brand-graphite/60">Referência geral, com vento medido a 10 m do solo. A bula, o receituário e o agrônomo valem mais.</p>
    </div>
  );
}

function getPosition(): Promise<{ lat: number; lon: number; label: string }> {
  const fallback = (): { lat: number; lon: number; label: string } => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_POS) ?? "null") as { lat: number; lon: number } | null;
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) return { ...saved, label: "último local" };
    } catch { /* ignora */ }
    return DEFAULT_PLACE;
  };
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(fallback());
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, label: "sua localização" };
        try { localStorage.setItem(LS_POS, JSON.stringify({ lat: pos.lat, lon: pos.lon })); } catch { /* ignora */ }
        resolve(pos);
      },
      () => resolve(fallback()),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Botão "Ver clima agora": pega a previsão do local (ou de Palmas-TO) e mostra o semáforo. */
export function ClimaWidget({ onFill, onResult, title = "Clima para aplicar" }: {
  onFill?: (v: { wind: number | null; temp: number | null; hum: number | null }) => void; onResult?: (input: ClimaInput) => void; title?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<ClimaInput | null>(null);
  const [place, setPlace] = useState("");
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setError(null);
    if (!navigator.onLine) { setState("error"); return setError("Sem sinal agora. Digite vento, temperatura e umidade que você mediu."); }
    setState("loading");
    try {
      const pos = await getPosition();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(openMeteoUrl(pos.lat, pos.lon), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("http");
      const parsed = parseOpenMeteo(await res.json());
      if (!parsed) throw new Error("vazio");
      setData(parsed); setPlace(pos.label); setState("done");
      onResult?.(parsed);
      const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
      onFill?.({ wind: r1(parsed.windKmh), temp: r1(parsed.tempC), hum: parsed.humidityPct == null ? null : Math.round(parsed.humidityPct) });
    } catch {
      setState("error");
      setError("Não consegui buscar a previsão agora. Tente de novo ou digite os valores medidos.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={check} disabled={state === "loading"} className={btn.ghost}>
          {state === "done" ? <LocateFixed className="size-5" aria-hidden /> : <CloudSun className="size-5" aria-hidden />}
          {state === "loading" ? "Buscando…" : state === "done" ? "Atualizar clima" : title}
        </button>
        {state === "idle" && <span className="text-xs text-brand-graphite/60">Usa a sua localização (ou Palmas-TO, se não liberar).</span>}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      {state === "done" && data && <ClimaSemaforo input={data} place={place} />}
    </div>
  );
}

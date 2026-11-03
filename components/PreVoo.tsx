"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { listOpenOS, savePreflightToOS } from "@/app/gestao/os/actions";
import { evaluateClima, LEVEL_LABEL, type ClimaInput, type Level } from "@/lib/clima";
import { todayBR } from "@/lib/format";
import { loadDayChecks, PREFLIGHT_ITEMS, saveDayChecks, toStored, type KV } from "@/lib/preflight";
import { ClimaWidget } from "./ClimaWidget";
import { btn, Card, CardTitle, inputClass, labelClass } from "./ui";

const kv: KV = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
const BANNER: Record<Level, string> = { bom: "border-brand-green bg-brand-green text-white", atencao: "border-brand-amber bg-brand-amber text-brand-dark", nao: "border-danger bg-danger text-white" };

/** Pré-voo: clima na hora + checklist do dia. Tudo no aparelho; opcionalmente registra numa OS aberta. */
export function PreVoo() {
  const [checks, setChecks] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [clima, setClima] = useState<ClimaInput | null>(null);
  const [open, setOpen] = useState<{ id: string; label: string }[] | null>(null);
  const [osId, setOsId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { setChecks(loadDayChecks(kv, todayBR())); setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveDayChecks(kv, todayBR(), checks); }, [checks, loaded]);

  const toggle = (id: string, on: boolean) => setChecks((c) => { const n = new Set(c); if (on) n.add(id); else n.delete(id); return n; });
  const result = useMemo(() => (clima ? evaluateClima(clima) : null), [clima]);
  const total = PREFLIGHT_ITEMS.length;
  const complete = checks.size === total;

  // Faixa de resultado: o que falta para liberar o voo
  let level: Level; let title: string; let hint: string;
  if (result?.level === "nao") { level = "nao"; title = LEVEL_LABEL.nao; hint = "O clima não está bom agora. Veja os motivos abaixo e espere melhorar."; }
  else if (complete && result?.level === "bom") { level = "bom"; title = "Pronto para aplicar"; hint = "Clima bom e checklist completo."; }
  else {
    level = "atencao";
    title = !result ? "Falta conferir o clima" : result.level === "atencao" ? "Atenção ao clima" : "Falta o checklist";
    hint = [!result && "Toque em “Ver o clima agora”.", result?.level === "atencao" && "Veja os motivos do clima abaixo.", !complete && `Checklist: ${checks.size} de ${total}.`].filter(Boolean).join(" ");
  }

  const loadOpen = () => start(async () => {
    setMsg(null);
    if (!navigator.onLine) return setMsg({ ok: false, text: "Sem sinal agora. Registre na OS quando o sinal voltar." });
    try {
      const r = await listOpenOS();
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setOpen(r.data ?? []);
      setOsId(r.data?.[0]?.id ?? "");
      if (!r.data?.length) setMsg({ ok: false, text: "Não há OS aberta. Abra uma em Operação → Nova OS." });
    } catch { setMsg({ ok: false, text: "Não deu para buscar as OS agora (sem sinal?)." }); }
  });

  const register = () => start(async () => {
    setMsg(null);
    try {
      const r = await savePreflightToOS({
        id: osId, checks: toStored(checks) ?? [],
        wind_kmh: clima?.windKmh ?? null, temp_c: clima?.tempC ?? null, humidity_pct: clima?.humidityPct ?? null,
      });
      setMsg(r.ok ? { ok: true, text: "Registrado na OS." } : { ok: false, text: r.error });
    } catch { setMsg({ ok: false, text: "Não deu para registrar agora (sem sinal?)." }); }
  });

  return (
    <div className="space-y-4">
      <div role="status" className={`rounded-2xl border-2 p-4 ${BANNER[level]}`}>
        <p className="text-2xl font-extrabold leading-tight">{title}</p>
        <p className="mt-1 text-sm font-medium opacity-95">{hint}</p>
      </div>

      <Card>
        <CardTitle>1. Clima agora</CardTitle>
        <ClimaWidget title="Ver o clima agora" onResult={setClima} />
      </Card>

      <Card>
        <CardTitle aside={<span className="text-sm font-bold text-brand-graphite/60">{checks.size}/{total}</span>}>2. Checklist do dia</CardTitle>
        <ul className="space-y-1">
          {PREFLIGHT_ITEMS.map((i) => (
            <li key={i.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2.5 hover:bg-black/[0.03]">
                <input type="checkbox" className="mt-0.5 size-6 shrink-0" checked={checks.has(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} />
                <span className="text-base leading-snug">{i.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-4 text-sm font-bold">
          <button type="button" className="text-brand-green underline" onClick={() => setChecks(complete ? new Set() : new Set(PREFLIGHT_ITEMS.map((i) => i.id)))}>{complete ? "Desmarcar tudo" : "Marcar tudo"}</button>
          {checks.size > 0 && !complete && <button type="button" className="text-brand-graphite/60 underline" onClick={() => setChecks(new Set())}>Limpar</button>}
        </div>
        <p className="mt-2 text-xs text-brand-graphite/60">O checklist fica guardado neste aparelho e zera amanhã.</p>
      </Card>

      <Card>
        <CardTitle>3. Registrar numa OS (opcional)</CardTitle>
        <p className="mb-3 text-sm text-brand-graphite/80">Guarda o checklist e o clima de agora na OS aberta, para ficar no histórico do serviço.</p>
        {open === null ? (
          <button type="button" className={btn.ghost} disabled={pending} onClick={loadOpen}><ClipboardCheck className="size-5" aria-hidden /> Escolher a OS</button>
        ) : open.length > 0 ? (
          <div className="space-y-3">
            <div><label htmlFor="pv-os" className={labelClass}>OS aberta</label>
              <select id="pv-os" className={inputClass} value={osId} onChange={(e) => setOsId(e.target.value)}>{open.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
            <button type="button" className={btn.primary} disabled={pending || !osId} onClick={register}><CheckCircle2 className="size-5" aria-hidden /> Registrar nesta OS</button>
          </div>
        ) : null}
        {msg && <p role="status" className={`mt-3 text-sm font-semibold ${msg.ok ? "text-brand-green" : "text-danger"}`}>{msg.text}</p>}
      </Card>
    </div>
  );
}

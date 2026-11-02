"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveClient, saveOS } from "@/app/gestao/os/actions";
import { FORMULATIONS, type DoseUnit, type Formulation, type Product } from "@/lib/calda";
import { formatBRL, parseMoney, todayBR } from "@/lib/format";
import { DEFAULT_PRICE_PER_HA, osTotal } from "@/lib/os";
import { btn, FormError, inputClass, labelClass } from "./ui";

export type OsClient = { id: string; name: string; price_per_ha: number | null };
export type OsInitial = {
  id: string; client_id: string; farm: string | null; service_date: string; area_ha: number; price_per_ha: number;
  crop: string | null; target: string | null; drone: string | null; operator_name: string | null;
  rate_l_ha: number | null; tank_l: number | null; products: Product[];
  wind_kmh: number | null; temp_c: number | null; humidity_pct: number | null; notes: string | null;
};

type Row = { name: string; dose: string; unit: DoseUnit; form: Formulation };
const UNITS: DoseUnit[] = ["L/ha", "mL/ha", "kg/ha", "g/ha"];
const txt = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : NaN);
const optNum = (s: string) => { const n = num(s); return Number.isFinite(n) ? n : null; };

// Lembra o drone/operador da última OS neste aparelho (a maioria das OS repete).
const LS_DRONE = "norte:os:drone";
const LS_OP = "norte:os:operador";
const readLS = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

export function OSForm({ clients: initialClients, initial, defaultClientId }: { clients: OsClient[]; initial?: OsInitial; defaultClientId?: string }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? "");
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState("");
  const [farm, setFarm] = useState(initial?.farm ?? "");
  const [date, setDate] = useState(initial?.service_date ?? todayBR());
  const [area, setArea] = useState(txt(initial?.area_ha));
  const [price, setPrice] = useState(initial ? txt(initial.price_per_ha) : "");
  const [crop, setCrop] = useState(initial?.crop ?? "");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [drone, setDrone] = useState(initial?.drone ?? readLS(LS_DRONE));
  const [operator, setOperator] = useState(initial?.operator_name ?? readLS(LS_OP));
  const [rate, setRate] = useState(txt(initial?.rate_l_ha));
  const [tank, setTank] = useState(txt(initial?.tank_l));
  const [rows, setRows] = useState<Row[]>(initial?.products.length ? initial.products.map((p) => ({ name: p.name, dose: txt(p.dose), unit: p.unit, form: p.form })) : []);
  const [wind, setWind] = useState(txt(initial?.wind_kmh));
  const [temp, setTemp] = useState(txt(initial?.temp_c));
  const [hum, setHum] = useState(txt(initial?.humidity_pct));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const client = clients.find((c) => c.id === clientId);
  const suggested = client?.price_per_ha ?? DEFAULT_PRICE_PER_HA;
  const priceN = price.trim() ? parseMoney(price) ?? NaN : suggested; // vazio = usa o valor do cliente (ou o padrão)
  const total = useMemo(() => osTotal(num(area), Number.isFinite(priceN) ? priceN : 0), [area, priceN]);
  const setRow = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const addClient = () => start(async () => {
    setError(null);
    const r = await saveClient({ name: newClient });
    if (!r.ok || !r.data) return setError(r.ok ? "Não foi possível cadastrar." : r.error);
    setClients((cs) => [...cs, { id: r.data!.id, name: newClient.trim(), price_per_ha: null }].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(r.data.id); setNewClient(""); setAddingClient(false);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId) return setError("Escolha o cliente.");
    const areaN = num(area);
    if (!(areaN > 0)) return setError("Informe a área em hectares.");
    if (!Number.isFinite(priceN)) return setError("Valor por hectare inválido.");
    const products: Product[] = [];
    for (const r of rows) {
      if (!r.name.trim() && !r.dose.trim()) continue;
      const dose = num(r.dose);
      if (!r.name.trim() || !(dose > 0)) return setError("Cada produto precisa de nome e dose (do receituário).");
      products.push({ name: r.name.trim(), dose, unit: r.unit, form: r.form });
    }
    start(async () => {
      const res = await saveOS({
        id: initial?.id, client_id: clientId, farm, service_date: date, area_ha: areaN, price_per_ha: priceN, crop, target, drone, operator_name: operator,
        rate_l_ha: optNum(rate), tank_l: optNum(tank), products, wind_kmh: optNum(wind), temp_c: optNum(temp), humidity_pct: optNum(hum), notes,
      });
      if (!res.ok || !res.data) return setError(res.ok ? "Não foi possível salvar." : res.error);
      writeLS(LS_DRONE, drone); writeLS(LS_OP, operator);
      router.push(`/gestao/os/${res.data.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-3">
        <div>
          <label htmlFor="client" className={labelClass}>Cliente</label>
          <div className="flex gap-2">
            <select id="client" className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— escolha o cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.price_per_ha != null ? ` · ${formatBRL(c.price_per_ha)}/ha` : ""}</option>)}
            </select>
            <button type="button" aria-label="Cadastrar novo cliente" onClick={() => setAddingClient((v) => !v)} className="shrink-0 rounded-xl border border-black/15 bg-white px-3 text-brand-green hover:bg-black/[0.03]"><Plus className="size-5" aria-hidden /></button>
          </div>
          {addingClient && (
            <div className="mt-2 flex gap-2">
              <input className={inputClass} placeholder="Nome do novo cliente" value={newClient} maxLength={120} onChange={(e) => setNewClient(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newClient.trim()) addClient(); } }} />
              <button type="button" disabled={pending || !newClient.trim()} onClick={addClient} className="shrink-0 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">Salvar</button>
            </div>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label htmlFor="farm" className={labelClass}>Fazenda / talhão</label><input id="farm" className={inputClass} value={farm} onChange={(e) => setFarm(e.target.value)} placeholder="Ex.: Fazenda Boa Vista — talhão 3" /></div>
          <div><label htmlFor="date" className={labelClass}>Data do serviço</label><input id="date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        </div>
      </section>

      <section className="rounded-xl border border-brand-green/30 bg-brand-green/[0.04] p-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="area" className={labelClass}>Área aplicada (ha)</label><input id="area" inputMode="decimal" className={`${inputClass} num text-xl font-extrabold`} value={area} onChange={(e) => setArea(e.target.value)} placeholder="0" /></div>
          <div><label htmlFor="price" className={labelClass}>Valor por ha (R$)</label><input id="price" inputMode="decimal" className={`${inputClass} num text-xl font-extrabold`} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={txt(suggested)} /></div>
        </div>
        <p className="mt-2 text-sm">
          {price.trim() ? "Valor digitado nesta OS." : client?.price_per_ha != null ? `Usando o valor do cliente (${formatBRL(client.price_per_ha)}/ha).` : `Usando o valor padrão (${formatBRL(DEFAULT_PRICE_PER_HA)}/ha).`}
          {" "}Total: <strong className="num text-lg">{formatBRL(total)}</strong>
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div><label htmlFor="crop" className={labelClass}>Cultura</label><input id="crop" className={inputClass} value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="Ex.: Soja, pastagem" /></div>
        <div><label htmlFor="target" className={labelClass}>Alvo / praga</label><input id="target" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        <div><label htmlFor="drone" className={labelClass}>Drone</label><input id="drone" className={inputClass} value={drone} onChange={(e) => setDrone(e.target.value)} placeholder="Ex.: T50" /></div>
        <div><label htmlFor="operator" className={labelClass}>Operador</label><input id="operator" className={inputClass} value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
      </section>

      <details className="rounded-xl border border-black/10 bg-white px-4 py-3" open={rows.length > 0 || !!rate}>
        <summary className="cursor-pointer text-sm font-bold">Calda e produtos (receituário)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="rate" className={labelClass}>Calda (L/ha)</label><input id="rate" inputMode="decimal" className={inputClass} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex.: 10" /></div>
            <div><label htmlFor="tank" className={labelClass}>Tanque (L)</label><input id="tank" inputMode="decimal" className={inputClass} value={tank} onChange={(e) => setTank(e.target.value)} placeholder="ex.: 40" /></div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-black/10 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem]">
                <input aria-label="Produto" className={inputClass} placeholder="Produto" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input aria-label="Dose" inputMode="decimal" className={inputClass} placeholder="Dose" value={r.dose} onChange={(e) => setRow(i, { dose: e.target.value })} />
                <select aria-label="Unidade" className={inputClass} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value as DoseUnit })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select aria-label="Formulação" className={`${inputClass} text-sm`} value={r.form} onChange={(e) => setRow(i, { form: e.target.value as Formulation })}>{FORMULATIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                <button type="button" aria-label="Tirar produto" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-danger/70 hover:bg-danger/5"><Trash2 className="size-5" aria-hidden /></button>
              </div>
            </div>
          ))}
          <button type="button" className={btn.ghost} onClick={() => setRows((rs) => [...rs, { name: "", dose: "", unit: "L/ha", form: "emulsao" }])}><Plus className="size-5" aria-hidden /> Adicionar produto</button>
          <p className="text-xs text-brand-graphite/60">Dose e produto são os do receituário do agrônomo. O sistema só organiza a conta por tanque.</p>
        </div>
      </details>

      <section>
        <p className={labelClass}>Clima na aplicação <span className="font-normal text-brand-graphite/50">(opcional)</span></p>
        <div className="grid grid-cols-3 gap-3">
          <input aria-label="Vento (km/h)" inputMode="decimal" className={inputClass} placeholder="Vento km/h" value={wind} onChange={(e) => setWind(e.target.value)} />
          <input aria-label="Temperatura (°C)" inputMode="decimal" className={inputClass} placeholder="Temp. °C" value={temp} onChange={(e) => setTemp(e.target.value)} />
          <input aria-label="Umidade (%)" inputMode="decimal" className={inputClass} placeholder="Umidade %" value={hum} onChange={(e) => setHum(e.target.value)} />
        </div>
      </section>

      <div><label htmlFor="notes" className={labelClass}>Observações</label><textarea id="notes" rows={2} maxLength={1000} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>{pending ? "Salvando…" : initial ? "Salvar alterações" : "Abrir OS"}</button>
        <button type="button" onClick={() => router.back()} className={btn.ghost}>Cancelar</button>
      </div>
    </form>
  );
}

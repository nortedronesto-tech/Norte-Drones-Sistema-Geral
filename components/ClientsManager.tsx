"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteClient, saveClient } from "@/app/gestao/os/actions";
import { formatBRL, parseMoney } from "@/lib/format";
import { DEFAULT_PRICE_PER_HA } from "@/lib/os";
import { btn, FormError, inputClass, labelClass } from "./ui";

export type ClientRow = {
  id: string; name: string; doc: string | null; phone: string | null; city: string | null; price_per_ha: number | null;
  notes: string | null; active: boolean; billed: number; open: number; orders: number;
};

const priceText = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

function Row({ c, canWrite, canManage }: { c: ClientRow; canWrite: boolean; canManage: boolean }) {
  const [d, setD] = useState({ name: c.name, doc: c.doc ?? "", phone: c.phone ?? "", city: c.city ?? "", price: priceText(c.price_per_ha), notes: c.notes ?? "", active: c.active });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<typeof d>) => { setMsg(null); setD((x) => ({ ...x, ...p })); };
  const save = () => start(async () => {
    const price = d.price.trim() ? parseMoney(d.price) : null;
    if (d.price.trim() && price === null) return setMsg({ ok: false, text: "Valor por hectare inválido." });
    const r = await saveClient({ id: c.id, name: d.name, doc: d.doc, phone: d.phone, city: d.city, price_per_ha: price, notes: d.notes, active: d.active });
    setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error });
  });
  const remove = () => { if (confirm(`Apagar o cliente "${c.name}"?`)) start(async () => { const r = await deleteClient(c.id); if (!r.ok) setMsg({ ok: false, text: r.error }); }); };

  return (
    <details className="group rounded-xl border border-black/10 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`block truncate font-bold ${c.active ? "" : "text-brand-graphite/50"}`}>{c.name}{!c.active && " (inativo)"}</span>
          <span className="text-xs text-brand-graphite/60">
            {c.price_per_ha != null ? `${formatBRL(c.price_per_ha)}/ha` : `padrão ${formatBRL(DEFAULT_PRICE_PER_HA)}/ha`} · {c.orders} OS{c.open > 0 && <> · a receber {formatBRL(c.open)}</>}
          </span>
        </span>
        <span className="num shrink-0 text-right font-extrabold">{formatBRL(c.billed)}<span className="block text-[11px] font-medium text-brand-graphite/50">faturado</span></span>
      </summary>
      <div className="space-y-3 border-t border-black/[0.06] p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className={labelClass}>Nome</label><input className={inputClass} value={d.name} disabled={!canWrite} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div><label className={labelClass}>Valor por hectare (R$)</label><input className={inputClass} inputMode="decimal" value={d.price} disabled={!canWrite} placeholder={`padrão ${DEFAULT_PRICE_PER_HA}`} onChange={(e) => patch({ price: e.target.value })} /></div>
          <div><label className={labelClass}>CNPJ / CPF</label><input className={inputClass} value={d.doc} disabled={!canWrite} onChange={(e) => patch({ doc: e.target.value })} /></div>
          <div><label className={labelClass}>Telefone / WhatsApp</label><input className={inputClass} inputMode="tel" value={d.phone} disabled={!canWrite} onChange={(e) => patch({ phone: e.target.value })} /></div>
          <div><label className={labelClass}>Cidade</label><input className={inputClass} value={d.city} disabled={!canWrite} onChange={(e) => patch({ city: e.target.value })} /></div>
          <div><label className={labelClass}>Observação</label><input className={inputClass} value={d.notes} disabled={!canWrite} onChange={(e) => patch({ notes: e.target.value })} /></div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5" checked={d.active} onChange={(e) => patch({ active: e.target.checked })} /> Ativo</label>
            <button type="button" className={btn.primary} disabled={pending || !d.name.trim()} onClick={save}>Salvar</button>
            {canManage && <button type="button" className={btn.danger} disabled={pending} onClick={remove}><Trash2 className="size-4" aria-hidden /> Apagar</button>}
            {msg && <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-brand-green" : "text-danger"}`}>{msg.text}</span>}
          </div>
        )}
      </div>
    </details>
  );
}

export function ClientsManager({ rows, canWrite, canManage }: { rows: ClientRow[]; canWrite: boolean; canManage: boolean }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = price.trim() ? parseMoney(price) : null;
    if (price.trim() && p === null) return setError("Valor por hectare inválido.");
    start(async () => { const r = await saveClient({ name, phone, price_per_ha: p }); if (!r.ok) return setError(r.error); setName(""); setPrice(""); setPhone(""); });
  };
  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={add} className="rounded-xl border border-black/10 bg-white p-3">
          <p className="mb-2 text-sm font-bold">Novo cliente</p>
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1.2fr_auto]">
            <input aria-label="Nome" className={inputClass} placeholder="Nome (ex.: Fazenda Boa Vista)" value={name} onChange={(e) => setName(e.target.value)} required />
            <input aria-label="Valor por hectare" className={inputClass} inputMode="decimal" placeholder={`R$/ha (padrão ${DEFAULT_PRICE_PER_HA})`} value={price} onChange={(e) => setPrice(e.target.value)} />
            <input aria-label="Telefone" className={inputClass} inputMode="tel" placeholder="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className={btn.primary} disabled={pending || !name.trim()}>Cadastrar</button>
          </div>
          <div className="mt-2"><FormError message={error} /></div>
        </form>
      )}
      <div className="space-y-2">{rows.map((c) => <Row key={c.id} c={c} canWrite={canWrite} canManage={canManage} />)}</div>
    </div>
  );
}

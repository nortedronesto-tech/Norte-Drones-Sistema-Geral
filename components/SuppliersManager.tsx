"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSupplier, saveSupplier } from "@/app/gestao/actions";
import { formatBRL } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { btn, FormError, inputClass, labelClass } from "./ui";

export type SupplierRow = Supplier & { total: number; open: number; count: number };

function Row({ s, canWrite, canManage }: { s: SupplierRow; canWrite: boolean; canManage: boolean }) {
  const [d, setD] = useState({ name: s.name, doc: s.doc ?? "", phone: s.phone ?? "", notes: s.notes ?? "", active: s.active });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<typeof d>) => { setMsg(null); setD((x) => ({ ...x, ...p })); };
  const save = () => start(async () => { const r = await saveSupplier({ id: s.id, ...d }); setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error }); });
  const remove = () => { if (confirm(`Apagar o fornecedor "${s.name}"? Os lançamentos continuam, só perdem o vínculo.`)) start(async () => { const r = await deleteSupplier(s.id); if (!r.ok) setMsg({ ok: false, text: r.error }); }); };

  return (
    <details className="group rounded-xl border border-black/10 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`block truncate font-bold ${s.active ? "" : "text-brand-graphite/50"}`}>{s.name}{!s.active && " (inativo)"}</span>
          <span className="text-xs text-brand-graphite/60">{s.count} compra(s){s.open > 0 && <> · a pagar {formatBRL(s.open)}</>}</span>
        </span>
        <span className="num shrink-0 text-right font-extrabold">{formatBRL(s.total)}<span className="block text-[11px] font-medium text-brand-graphite/50">já pago</span></span>
      </summary>
      <div className="space-y-3 border-t border-black/[0.06] p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className={labelClass}>Nome</label><input className={inputClass} value={d.name} disabled={!canWrite} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div><label className={labelClass}>CNPJ / CPF</label><input className={inputClass} value={d.doc} disabled={!canWrite} onChange={(e) => patch({ doc: e.target.value })} /></div>
          <div><label className={labelClass}>Telefone</label><input className={inputClass} inputMode="tel" value={d.phone} disabled={!canWrite} onChange={(e) => patch({ phone: e.target.value })} /></div>
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

export function SuppliersManager({ rows, canWrite, canManage }: { rows: SupplierRow[]; canWrite: boolean; canManage: boolean }) {
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => { const r = await saveSupplier({ name, doc, phone }); if (!r.ok) return setError(r.error); setName(""); setDoc(""); setPhone(""); });
  };
  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={add} className="rounded-xl border border-black/10 bg-white p-3">
          <p className="mb-2 text-sm font-bold">Novo fornecedor</p>
          <div className="grid gap-2 md:grid-cols-[2fr_1.2fr_1fr_auto]">
            <input aria-label="Nome" className={inputClass} placeholder="Nome (ex.: Posto Ipiranga)" value={name} onChange={(e) => setName(e.target.value)} required />
            <input aria-label="CNPJ ou CPF" className={inputClass} placeholder="CNPJ / CPF (opcional)" value={doc} onChange={(e) => setDoc(e.target.value)} />
            <input aria-label="Telefone" className={inputClass} inputMode="tel" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className={btn.primary} disabled={pending || !name.trim()}>Cadastrar</button>
          </div>
          <div className="mt-2"><FormError message={error} /></div>
        </form>
      )}
      <div className="space-y-2">{rows.map((s) => <Row key={s.id} s={s} canWrite={canWrite} canManage={canManage} />)}</div>
    </div>
  );
}

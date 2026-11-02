"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createSupplier } from "@/app/gestao/actions";
import type { Supplier } from "@/lib/types";
import { inputClass, labelClass } from "./ui";

/** "Comprei de quem?": escolhe um fornecedor cadastrado ou cadastra um novo na hora (só o nome). */
export function SupplierPicker({ suppliers, value, onChange }: {
  suppliers: Pick<Supplier, "id" | "name">[]; value: string; onChange: (id: string) => void;
}) {
  const [extra, setExtra] = useState<Pick<Supplier, "id" | "name">[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = [...suppliers, ...extra.filter((e) => !suppliers.some((s) => s.id === e.id))].sort((a, b) => a.name.localeCompare(b.name));

  const add = () => start(async () => {
    setError(null);
    const res = await createSupplier(name);
    if (!res.ok) return setError(res.error);
    if (res.data) { setExtra((x) => [...x, res.data!]); onChange(res.data.id); }
    setName(""); setAdding(false);
  });

  return (
    <div>
      <label htmlFor="supplier" className={labelClass}>Fornecedor <span className="font-normal text-brand-graphite/50">(comprei de quem — opcional)</span></label>
      <div className="flex gap-2">
        <select id="supplier" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">— sem fornecedor —</option>
          {all.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={() => setAdding((v) => !v)} aria-label="Cadastrar novo fornecedor"
          className="shrink-0 rounded-xl border border-black/15 bg-white px-3 text-brand-green hover:bg-black/[0.03]"><Plus className="size-5" aria-hidden /></button>
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Nome do novo fornecedor" className={inputClass}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (name.trim()) add(); } }} />
          <button type="button" disabled={pending || !name.trim()} onClick={add} className="shrink-0 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">Salvar</button>
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

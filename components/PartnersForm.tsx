"use client";

import { useState, useTransition } from "react";
import { savePartnerShares, updatePartner } from "@/app/(app)/actions";
import type { Partner } from "@/lib/types";
import { btn, FormError, inputClass, labelClass } from "./ui";

export function PartnersForm({ partners }: { partners: Partner[] }) {
  const [rows, setRows] = useState(partners.map((p) => ({ id: p.id, name: p.name, email: p.email ?? "", pct: String(p.share_pct) })));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const total = Math.round(rows.reduce((a, r) => a + (Number(r.pct.replace(",", ".")) || 0), 0) * 100) / 100;
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => {
    setSaved(false);
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (Math.abs(total - 100) > 0.001) return setError(`Os percentuais somam ${total}%. Precisam somar 100%.`);
    start(async () => {
      for (const r of rows) {
        const res = await updatePartner({ id: r.id, name: r.name, email: r.email });
        if (!res.ok) return setError(res.error);
      }
      const res = await savePartnerShares(rows.map((r) => ({ id: r.id, pct: Number(r.pct.replace(",", ".")) })));
      if (!res.ok) return setError(res.error);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {rows.map((r, i) => (
        <div key={r.id} className="grid gap-3 rounded-xl border border-black/10 p-3 md:grid-cols-[1fr_1fr_7rem]">
          <div>
            <label htmlFor={`n-${r.id}`} className={labelClass}>Nome</label>
            <input id={`n-${r.id}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor={`e-${r.id}`} className={labelClass}>E-mail de login</label>
            <input id={`e-${r.id}`} type="email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} placeholder="ainda não definido" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`p-${r.id}`} className={labelClass}>Participação %</label>
            <input id={`p-${r.id}`} inputMode="decimal" value={r.pct} onChange={(e) => set(i, { pct: e.target.value })} className={`${inputClass} num`} required />
          </div>
        </div>
      ))}
      <p className={`text-sm font-semibold ${Math.abs(total - 100) > 0.001 ? "text-danger" : "text-brand-green"}`}>Soma: {total}%</p>
      <p className="text-xs text-brand-graphite/60">
        Mudar o percentual vale para as próximas entradas recebidas; o rateio das já recebidas fica como foi calculado.
        O e-mail do sócio precisa ter usuário criado em Supabase → Authentication → Users para ele conseguir entrar.
      </p>
      <FormError message={error} />
      {saved && <p role="status" className="text-sm font-semibold text-brand-green">Sócios salvos.</p>}
      <button disabled={pending} className={btn.primary}>{pending ? "Salvando…" : "Salvar sócios"}</button>
    </form>
  );
}

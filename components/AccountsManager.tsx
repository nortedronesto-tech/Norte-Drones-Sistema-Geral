"use client";

import { useState, useTransition } from "react";
import { saveAccount } from "@/app/gestao/actions";
import { ACCOUNT_KIND_LABEL } from "@/lib/constants";
import { parseMoney } from "@/lib/format";
import type { AccountKind, BankAccount, Partner } from "@/lib/types";
import { btn, FormError, inputClass, labelClass } from "./ui";

interface Draft { id?: string; name: string; kind: AccountKind; partner_id: string; initial: string; active: boolean }

const toDraft = (a: BankAccount): Draft => ({
  id: a.id, name: a.name, kind: a.kind, partner_id: a.partner_id ?? "",
  initial: String(a.initial_balance).replace(".", ","), active: a.active,
});
const blank: Draft = { name: "", kind: "mei", partner_id: "", initial: "0", active: true };

function AccountRow({ initial, partners, onSaved }: { initial: Draft; partners: Partner[]; onSaved?: () => void }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const isNew = !d.id;
  const patch = (p: Partial<Draft>) => { setSaved(false); setD((x) => ({ ...x, ...p })); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const bal = parseMoney(d.initial || "0");
    if (bal === null) return setError("Saldo inicial inválido.");
    start(async () => {
      const res = await saveAccount({ id: d.id, name: d.name, kind: d.kind, partner_id: d.partner_id || null, initial_balance: bal, active: d.active });
      if (!res.ok) return setError(res.error);
      if (isNew) { setD(blank); onSaved?.(); } else setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-black/10 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`an-${d.id ?? "new"}`}>Nome da conta</label>
          <input id={`an-${d.id ?? "new"}`} value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Conta MEI — Helbert" className={inputClass} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`ak-${d.id ?? "new"}`}>Tipo</label>
          <select id={`ak-${d.id ?? "new"}`} value={d.kind} onChange={(e) => patch({ kind: e.target.value as AccountKind })} className={inputClass}>
            {Object.entries(ACCOUNT_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`ap-${d.id ?? "new"}`}>Titular</label>
          <select id={`ap-${d.id ?? "new"}`} value={d.partner_id} onChange={(e) => patch({ partner_id: e.target.value })} className={inputClass}>
            <option value="">Sociedade / nenhum</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`ab-${d.id ?? "new"}`}>Saldo inicial (R$)</label>
          <input id={`ab-${d.id ?? "new"}`} inputMode="decimal" value={d.initial} onChange={(e) => patch({ initial: e.target.value })} className={`${inputClass} num`} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isNew && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={d.active} onChange={(e) => patch({ active: e.target.checked })} className="size-5 accent-[#2e7d32]" /> Conta ativa
          </label>
        )}
        <button disabled={pending} className={`${isNew ? btn.primary : btn.ghost} ml-auto`}>{pending ? "Salvando…" : isNew ? "Adicionar conta" : "Salvar"}</button>
      </div>
      <FormError message={error} />
      {saved && <p role="status" className="text-sm font-semibold text-brand-green">Salvo.</p>}
    </form>
  );
}

export function AccountsManager({ accounts, partners }: { accounts: BankAccount[]; partners: Partner[] }) {
  const [showNew, setShowNew] = useState(false);
  return (
    <div className="space-y-3">
      {accounts.map((a) => <AccountRow key={a.id} initial={toDraft(a)} partners={partners} />)}
      {showNew ? (
        <AccountRow initial={blank} partners={partners} onSaved={() => setShowNew(false)} />
      ) : (
        <button type="button" onClick={() => setShowNew(true)} className={btn.ghost}>+ Nova conta</button>
      )}
      <p className="text-xs text-brand-graphite/60">
        O saldo inicial é o dinheiro que já estava na conta quando você começou a usar o sistema. Contas sem lançamentos podem
        ser desativadas; as que têm histórico ficam inativas, sem apagar nada.
      </p>
    </div>
  );
}

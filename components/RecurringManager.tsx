"use client";

import { useState, useTransition } from "react";
import { Play, Trash2 } from "lucide-react";
import { deleteRecurring, generateNow, saveRecurring, setRecurringActive } from "@/app/gestao/recorrentes/actions";
import { categoriesFor } from "@/lib/constants";
import { formatBRL, formatDate, parseMoney, todayBR } from "@/lib/format";
import { LEAD_DAYS } from "@/lib/recurring";
import type { AccountBalance, Supplier, TxType } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { SupplierPicker } from "./SupplierPicker";
import { btn, Card, CardTitle, EmptyState, FormError, inputClass, labelClass } from "./ui";

export type RecurringRow = {
  id: string; type: TxType; amount: number; category: string; description: string | null; day_of_month: number;
  next_due: string; end_date: string | null; active: boolean; account: string; supplier: string | null;
};

export function RecurringManager({ rows, accounts, suppliers, canWrite, canManage }: {
  rows: RecurringRow[]; accounts: AccountBalance[]; suppliers: Supplier[]; canWrite: boolean; canManage: boolean;
}) {
  const [type, setType] = useState<TxType>("saida");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [category, setCategory] = useState(categoriesFor("saida")[0]);
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [firstDue, setFirstDue] = useState(todayBR());
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const changeType = (t: TxType) => { setType(t); setCategory(categoriesFor(t)[0]); };
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 5000); };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = parseMoney(amount);
    if (!v || v <= 0) return setError("Informe um valor maior que zero.");
    start(async () => {
      const r = await saveRecurring({ type, amount: v, account_id: accountId, category, description, supplier_id: type === "saida" ? supplierId || null : null, first_due: firstDue, end_date: endDate || null });
      if (!r.ok) return setError(r.error);
      setAmount(""); setDescription(""); setEndDate("");
      flash("Cadastrado. O lançamento aparece em contas a pagar/receber " + LEAD_DAYS + " dias antes do vencimento.");
    });
  };
  const gen = () => start(async () => { const r = await generateNow(); flash(r.ok ? (r.data?.created ? `${r.data.created} lançamento(s) criado(s).` : "Nada a gerar agora.") : r.error); });
  const seg = (on: boolean, tone: string) => `flex-1 rounded-xl px-4 py-3 font-bold ${on ? tone : "bg-black/[0.05] text-brand-graphite/70"}`;

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card>
          <CardTitle>Nova regra mensal</CardTitle>
          <form onSubmit={add} className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="Tipo">
              <button type="button" aria-pressed={type === "saida"} className={seg(type === "saida", "bg-danger text-white")} onClick={() => changeType("saida")}>Saída (a pagar)</button>
              <button type="button" aria-pressed={type === "entrada"} className={seg(type === "entrada", "bg-brand-green text-white")} onClick={() => changeType("entrada")}>Entrada (a receber)</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="ramount" className={labelClass}>Valor (R$)</label><input id="ramount" inputMode="decimal" className={`${inputClass} num text-xl font-extrabold`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required /></div>
              <div><label htmlFor="rcat" className={labelClass}>Categoria</label><select id="rcat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>{categoriesFor(type).map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Conta bancária" />
            {type === "saida" && <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />}
            <div><label htmlFor="rdesc" className={labelClass}>Descrição</label><input id="rdesc" className={inputClass} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel do carro" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="rfirst" className={labelClass}>Primeiro vencimento</label><input id="rfirst" type="date" className={inputClass} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} required /><p className="mt-1 text-xs text-brand-graphite/60">Repete todo mês neste dia (mês curto usa o último dia).</p></div>
              <div><label htmlFor="rend" className={labelClass}>Termina em (opcional)</label><input id="rend" type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <FormError message={error} />
            <button className={btn.primary} disabled={pending}>Cadastrar regra</button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle aside={canWrite ? <button type="button" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-green hover:underline disabled:opacity-60" disabled={pending} onClick={gen}><Play className="size-4" aria-hidden /> Gerar agora</button> : undefined}>Regras cadastradas</CardTitle>
        {msg && <p role="status" className="mb-3 rounded-xl bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green">{msg}</p>}
        {rows.length === 0 ? <EmptyState>Nenhuma regra ainda. Cadastre aluguel, seguro, DAS do MEI e outras contas que se repetem todo mês.</EmptyState> : (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((r) => (
              <li key={r.id} className={`py-3 ${r.active ? "" : "opacity-55"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.description || r.category}{!r.active && <span className="ml-2 text-xs font-normal">(pausada)</span>}</p>
                    <p className="text-xs text-brand-graphite/60">Todo dia {r.day_of_month} · {r.account}{r.supplier ? ` · ${r.supplier}` : ""} · próximo {formatDate(r.next_due)}{r.end_date ? ` · até ${formatDate(r.end_date)}` : ""}</p>
                  </div>
                  <p className={`num shrink-0 font-bold ${r.type === "entrada" ? "text-brand-green" : "text-danger"}`}>{r.type === "entrada" ? "+" : "−"} {formatBRL(r.amount)}</p>
                </div>
                {canWrite && (
                  <div className="mt-2 flex gap-3 text-sm font-bold">
                    <button type="button" className="text-brand-green underline" disabled={pending} onClick={() => start(async () => { const x = await setRecurringActive(r.id, !r.active); if (!x.ok) flash(x.error); })}>{r.active ? "Pausar" : "Reativar"}</button>
                    {canManage && <button type="button" className="inline-flex items-center gap-1 text-danger underline" disabled={pending} onClick={() => { if (confirm("Apagar esta regra? Os lançamentos já criados continuam.")) start(async () => { const x = await deleteRecurring(r.id); if (!x.ok) flash(x.error); }); }}><Trash2 className="size-4" aria-hidden /> Apagar</button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

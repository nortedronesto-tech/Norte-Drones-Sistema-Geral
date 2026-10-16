"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/app/gestao/actions";
import { categoriesFor } from "@/lib/constants";
import { formatBRL, parseMoney, todayBR } from "@/lib/format";
import { previewSplit } from "@/lib/split";
import type { BankAccount, Partner, TxStatus, TxType } from "@/lib/types";
import { btn, Card, FormError, inputClass, labelClass } from "./ui";

export function TransactionForm({
  accounts,
  partners,
  reservePct,
}: {
  accounts: BankAccount[];
  partners: Partner[];
  reservePct: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<TxType>("entrada");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [category, setCategory] = useState(categoriesFor("entrada")[0]);
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [date, setDate] = useState(todayBR());

  const amount = parseMoney(amountText);
  const status: TxStatus = paid ? "pago" : type === "entrada" ? "a_receber" : "a_pagar";
  const preview = useMemo(
    () => (type === "entrada" && amount && amount > 0 ? previewSplit(amount, reservePct, partners) : null),
    [type, amount, reservePct, partners],
  );

  function changeType(next: TxType) {
    setType(next);
    setCategory(categoriesFor(next)[0]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || amount <= 0) return setError("Informe um valor maior que zero.");
    if (!accountId) return setError("Escolha a conta.");
    startTransition(async () => {
      const res = await createTransaction({ type, amount, account_id: accountId, category, description, status, date });
      if (!res.ok) return setError(res.error);
      router.push("/gestao/lancamentos");
    });
  }

  const seg = (active: boolean, tone: "in" | "out" | "neutral") =>
    `flex-1 rounded-xl px-4 py-3 text-base font-bold transition ${
      active
        ? tone === "in" ? "bg-brand-green text-white" : tone === "out" ? "bg-danger text-white" : "bg-brand-dark text-white"
        : "bg-black/[0.05] text-brand-graphite/70 hover:bg-black/[0.08]"
    }`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2" role="group" aria-label="Tipo de lançamento">
        <button type="button" onClick={() => changeType("entrada")} className={seg(type === "entrada", "in")} aria-pressed={type === "entrada"}>Entrada</button>
        <button type="button" onClick={() => changeType("saida")} className={seg(type === "saida", "out")} aria-pressed={type === "saida"}>Saída</button>
      </div>

      <div>
        <label htmlFor="amount" className={labelClass}>Valor (R$)</label>
        <input id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amountText}
          onChange={(e) => setAmountText(e.target.value)} className={`${inputClass} num text-2xl font-extrabold`} required />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="account" className={labelClass}>Conta</label>
          <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>Categoria</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {categoriesFor(type).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descrição <span className="font-normal text-brand-graphite/50">(opcional)</span></label>
        <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}
          placeholder={type === "entrada" ? "Ex.: Fazenda Boa Vista — 40 ha" : "Ex.: Diesel L200"} className={inputClass} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className={labelClass}>Situação</span>
          <div className="flex gap-2" role="group" aria-label="Situação">
            <button type="button" onClick={() => setPaid(true)} className={seg(paid, "neutral")} aria-pressed={paid}>{type === "entrada" ? "Recebido" : "Pago"}</button>
            <button type="button" onClick={() => setPaid(false)} className={seg(!paid, "neutral")} aria-pressed={!paid}>{type === "entrada" ? "A receber" : "A pagar"}</button>
          </div>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>{paid ? "Data" : "Vencimento"}</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
      </div>

      {preview && (
        <Card className="border-brand-green/30 bg-brand-green/[0.04]">
          <p className="text-sm font-bold text-brand-dark">
            {paid ? "Rateio desta entrada" : "Previsão de rateio (acontece quando for recebida)"}
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Fundo de reserva ({reservePct}%)</dt><dd className="num font-bold">{formatBRL(preview.reserve)}</dd></div>
            {preview.partners.map((p) => (
              <div key={p.id} className="flex justify-between gap-3">
                <dt className="min-w-0 truncate">{p.name} ({p.pct}%)</dt>
                <dd className="num font-bold">{formatBRL(p.share)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-brand-graphite/60">
            A reserva é retida primeiro ({preview.partners.map((p) => formatBRL(p.reserve)).join(" + ")}); o restante é dividido pelos percentuais.
          </p>
        </Card>
      )}

      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>{pending ? "Salvando…" : "Salvar lançamento"}</button>
        <button type="button" onClick={() => router.back()} className={btn.ghost}>Cancelar</button>
      </div>
    </form>
  );
}

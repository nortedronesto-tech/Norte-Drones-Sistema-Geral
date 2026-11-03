"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransaction } from "@/app/gestao/actions";
import { categoriesFor } from "@/lib/constants";
import { formatBRL, parseMoney } from "@/lib/format";
import type { AccountBalance, Supplier, Transaction } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { SupplierPicker } from "./SupplierPicker";
import { btn, FormError, inputClass, labelClass } from "./ui";

/** Corrige um lançamento existente (valor, conta, categoria, fornecedor, descrição e data). */
export function TransactionEditForm({ tx, accounts, suppliers }: { tx: Transaction; accounts: AccountBalance[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(tx.amount).replace(".", ","));
  const [accountId, setAccountId] = useState(tx.account_id);
  const [category, setCategory] = useState(tx.category);
  const [supplierId, setSupplierId] = useState(tx.supplier_id ?? "");
  const [description, setDescription] = useState(tx.description ?? "");
  const [date, setDate] = useState(tx.status === "pago" ? tx.paid_at ?? tx.date : tx.date);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const paid = tx.status === "pago";
  const cats = categoriesFor(tx.type);
  const options = cats.includes(category) ? cats : [category, ...cats]; // categoria antiga continua selecionável

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = parseMoney(amount);
    if (!v || v <= 0) return setError("Informe um valor maior que zero.");
    start(async () => {
      const res = await updateTransaction({
        id: tx.id, amount: v, account_id: accountId, category, description, date,
        supplier_id: tx.type === "saida" ? supplierId || null : undefined,
      });
      if (!res.ok) return setError(res.error);
      router.push("/gestao/lancamentos");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="rounded-xl bg-black/[0.04] px-4 py-3 text-sm">
        {tx.type === "entrada" ? "Entrada" : "Saída"} · {paid ? (tx.type === "entrada" ? "Recebida" : "Paga") : tx.type === "entrada" ? "A receber" : "A pagar"} · valor atual {formatBRL(tx.amount)}.
        {" "}O tipo e a situação não mudam aqui.
      </p>
      {tx.type === "entrada" && paid && <p className="rounded-xl bg-brand-amber/15 px-4 py-3 text-sm text-[#7a4a00]">Esta entrada já foi recebida: ao mudar o valor, o rateio entre os sócios e a reserva são recalculados.</p>}

      <div>
        <label htmlFor="amount" className={labelClass}>Valor (R$)</label>
        <input id="amount" inputMode="decimal" autoComplete="off" className={`${inputClass} num text-2xl font-extrabold`} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Conta bancária" />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>Categoria</label>
          <select id="category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>{options.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {tx.type === "saida" && <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />}
      </div>
      <div>
        <label htmlFor="description" className={labelClass}>Descrição</label>
        <input id="description" className={inputClass} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="date" className={labelClass}>{paid ? "Data do pagamento" : "Vencimento"}</label>
        <input id="date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      {tx.reconciled_at && <p className="text-sm text-[#7a4a00]">Este lançamento estava conciliado com o extrato. Ao salvar, ele volta para “não conferido”.</p>}

      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>{pending ? "Salvando…" : "Salvar alterações"}</button>
        <button type="button" onClick={() => router.back()} className={btn.ghost}>Cancelar</button>
      </div>
    </form>
  );
}

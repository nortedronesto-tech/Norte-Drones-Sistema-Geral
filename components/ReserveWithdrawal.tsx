"use client";

import { useState, useTransition } from "react";
import { createReserveWithdrawal } from "@/app/gestao/actions";
import { parseMoney, todayBR } from "@/lib/format";
import { btn, FormError, inputClass, labelClass } from "./ui";

export function ReserveWithdrawal({ balance }: { balance: number }) {
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayBR());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const amount = parseMoney(amountText);
    if (!amount || amount <= 0) return setError("Informe o valor da retirada.");
    if (amount > balance) return setError("A retirada é maior que o saldo do fundo.");
    startTransition(async () => {
      const res = await createReserveWithdrawal({ amount, description, date });
      if (!res.ok) return setError(res.error);
      setAmountText("");
      setDescription("");
      setOk(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-brand-graphite/70">
        Use quando o dinheiro da reserva for gasto (ex.: bateria nova). Isto só baixa o saldo do fundo; registre também a
        despesa em Lançamentos para ela sair da conta.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="w-amount" className={labelClass}>Valor (R$)</label>
          <input id="w-amount" inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} className={`${inputClass} num`} required />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="w-desc" className={labelClass}>Para quê</label>
          <input id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Bateria T40" maxLength={300} className={inputClass} required />
        </div>
      </div>
      <div className="max-w-xs">
        <label htmlFor="w-date" className={labelClass}>Data</label>
        <input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
      </div>
      <FormError message={error} />
      {ok && <p role="status" className="text-sm font-semibold text-brand-green">Retirada registrada.</p>}
      <button disabled={pending} className={btn.primary}>{pending ? "Registrando…" : "Registrar retirada"}</button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Image as ImageIcon, Trash2 } from "lucide-react";
import { deleteTransaction, markPaid } from "@/app/gestao/actions";
import { formatBRL, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { FormError, Money, StatusBadge } from "./ui";

export function TransactionList({ rows, receiptUrls, canWrite = true }: { rows: Transaction[]; receiptUrls: Record<string, string>; canWrite?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Não foi possível concluir.");
      setPendingId(null);
    });
  }

  return (
    <div>
      <FormError message={error} />
      <ul className="mt-2 divide-y divide-black/[0.06]">
        {rows.map((t) => {
          const busy = pendingId === t.id;
          const receipt = t.receipt_path ? receiptUrls[t.receipt_path] : undefined;
          return (
            <li key={t.id} className={`py-3.5 ${busy ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{t.description || t.category}</p>
                  <p className="mt-0.5 text-xs text-brand-graphite/60">
                    {t.description ? `${t.category} · ` : ""}
                    {formatDate(t.date)} · {t.bank_accounts?.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={formatBRL(t.amount)} signed type={t.type} />
                  <div className="mt-1"><StatusBadge status={t.status} type={t.type} /></div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canWrite && t.status !== "pago" && (
                  <button
                    disabled={busy}
                    onClick={() => run(t.id, () => markPaid(t.id))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green/10 px-3 py-1.5 text-sm font-bold text-brand-green hover:bg-brand-green/15"
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    {t.type === "entrada" ? "Marcar como recebido" : "Marcar como pago"}
                  </button>
                )}
                {receipt && (
                  <a
                    href={receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-3 py-1.5 text-sm font-semibold hover:bg-black/[0.08]"
                  >
                    <ImageIcon className="size-4" aria-hidden /> Ver foto
                  </a>
                )}
                {canWrite && <button
                  disabled={busy}
                  onClick={() => {
                    const extra = t.type === "entrada" && t.status === "pago" ? " O rateio e a retenção da reserva dela também serão desfeitos." : "";
                    if (confirm(`Excluir este lançamento de ${formatBRL(t.amount)}?${extra}`)) run(t.id, () => deleteTransaction(t.id));
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-danger/80 hover:bg-danger/5"
                  aria-label="Excluir lançamento"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

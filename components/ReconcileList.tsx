"use client";

import { useState, useTransition } from "react";
import { setReconciled } from "@/app/gestao/actions";
import { formatBRL, formatDate } from "@/lib/format";
import { FormError, Money } from "@/components/ui";

export type ReconRow = { id: string; type: "entrada" | "saida"; amount: number; date: string; label: string; reconciled: boolean };

export function ReconcileList({ rows, canWrite }: { rows: ReconRow[]; canWrite: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (ids: string[], on: boolean) => {
    setError(null);
    start(async () => { const r = await setReconciled(ids, on); if (!r.ok) setError(r.error); });
  };
  const open = rows.filter((r) => !r.reconciled).map((r) => r.id);
  return (
    <div>
      <FormError message={error} />
      {canWrite && open.length > 0 && (
        <button type="button" disabled={pending} onClick={() => { if (confirm(`Marcar os ${open.length} lançamentos desta lista como conferidos com o extrato?`)) run(open, true); }}
          className="mb-2 mt-1 text-sm font-bold text-brand-green underline disabled:opacity-50">Marcar todos como conferidos</button>
      )}
      <ul className="divide-y divide-black/[0.06]">
        {rows.map((r) => (
          <li key={r.id}>
            <label className={`flex items-center gap-3 py-3 ${canWrite ? "cursor-pointer" : ""} ${pending ? "opacity-60" : ""}`}>
              <input type="checkbox" className="size-5 accent-[var(--color-brand-green)]" checked={r.reconciled} disabled={!canWrite || pending}
                onChange={(e) => run([r.id], e.target.checked)} aria-label={`Conferido: ${r.label}`} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block font-semibold leading-snug">{r.label}</span>
                <span className="text-xs text-brand-graphite/60">{formatDate(r.date)}</span>
              </span>
              <Money value={formatBRL(r.amount)} signed type={r.type} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

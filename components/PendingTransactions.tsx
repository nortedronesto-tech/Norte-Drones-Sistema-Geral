"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, X } from "lucide-react";
import { financeQueue, flushFinanceQueue, QUEUE_EVENT } from "@/lib/offline-finance";
import type { QueueItem } from "@/lib/finance-queue";
import { formatDate } from "@/lib/format";

/** Lançamentos e recibos feitos sem sinal que ainda não foram enviados (aparecem no topo da lista). */
export function PendingTransactions() {
  const [items, setItems] = useState<(QueueItem & { thumb?: string })[]>([]);

  const load = useCallback(async () => {
    try {
      const q = financeQueue();
      const list = await q.list();
      const withThumb = await Promise.all(list.map(async (i) => {
        const blob = await q.blobOf(i);
        return { ...i, thumb: blob ? URL.createObjectURL(blob) : undefined };
      }));
      setItems((old) => { old.forEach((o) => o.thumb && URL.revokeObjectURL(o.thumb)); return withThumb; });
    } catch { setItems([]); }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(QUEUE_EVENT, load);
    return () => window.removeEventListener(QUEUE_EVENT, load);
  }, [load]);

  if (items.length === 0) return null;
  return (
    <section aria-label="Aguardando envio" className="mb-4 rounded-2xl border border-brand-amber/50 bg-brand-amber/10 p-3">
      <p className="flex items-center gap-2 text-sm font-extrabold text-brand-dark"><CloudOff className="size-4" aria-hidden /> Aguardando envio ({items.length})</p>
      <p className="mt-0.5 text-xs text-brand-graphite/70">Guardado neste aparelho. Vai sozinho quando houver sinal.</p>
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-xl bg-white p-2">
            {i.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.thumb} alt="Recibo guardado" className="size-14 shrink-0 rounded-lg object-cover" />
            ) : <div className="size-14 shrink-0 rounded-lg bg-black/[0.06]" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{i.label}</p>
              <p className="text-xs text-brand-graphite/60">{i.kind === "attach" ? "Recibo para anexar" : formatDate(i.payload?.date ?? i.date)}{!i.receipt && i.kind === "transaction" ? " · sem foto" : ""}</p>
              {i.error && <p className="mt-0.5 text-xs font-bold text-danger">Recusado: {i.error}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-bold">
              {i.error && <button type="button" className="underline" onClick={async () => { await financeQueue().retry(i.key); await flushFinanceQueue(); }}>Tentar de novo</button>}
              <button type="button" className="inline-flex items-center gap-1 text-danger/80 underline" onClick={async () => { if (confirm("Descartar este registro guardado no aparelho? Ele não será enviado.")) { await financeQueue().discard(i.key); window.dispatchEvent(new Event(QUEUE_EVENT)); } }}><X className="size-3" aria-hidden /> Descartar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

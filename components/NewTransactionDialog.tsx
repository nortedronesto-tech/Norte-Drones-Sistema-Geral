"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { AccountBalance, Partner, Supplier } from "@/lib/types";
import { TransactionForm } from "./TransactionForm";
import { btn } from "./ui";

/** "Novo lançamento" dentro de Lançamentos: janela única para lançar por foto, voz ou à mão, com o recibo anexado. */
export function NewTransactionDialog({ accounts, partners, reservePct, suppliers, defaultOpen = false }: {
  accounts: AccountBalance[]; partners: Partner[]; reservePct: number; suppliers: Supplier[]; defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const dirty = useRef(false);

  // Lê o ?novo=1 no próprio aparelho: sem sinal a página vem do cache e o servidor não repassa o parâmetro.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") setOpen(true);
  }, []);

  /** fecha sem perguntar (depois de salvar) */
  function close() {
    dirty.current = false;
    setOpen(false);
    if (new URLSearchParams(window.location.search).get("novo") === "1") router.replace("/gestao/lancamentos"); // tira o ?novo=1 da barra
  }

  /** fecha pelo X, Esc ou Cancelar: se há algo digitado, confirma para não perder sem querer */
  function tryClose() {
    if (dirty.current && !window.confirm("Você já preencheu dados. Fechar e descartar este lançamento?")) return;
    close();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") tryClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btn.primary} w-full md:w-auto`}>
        <Plus className="size-5" aria-hidden /> Novo lançamento
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Novo lançamento">
          <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 md:max-w-2xl md:rounded-3xl md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-brand-dark">Novo lançamento</h2>
              <button type="button" onClick={tryClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-black/5"><X className="size-5" aria-hidden /></button>
            </div>
            <TransactionForm accounts={accounts} partners={partners} reservePct={reservePct} suppliers={suppliers}
              onDone={() => { close(); router.refresh(); }} onCancel={tryClose} onDirtyChange={(d) => { dirty.current = d; }} />
          </div>
        </div>
      )}
    </>
  );
}

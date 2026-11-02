"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";
import { ACCOUNT_KIND_LABEL } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import type { AccountBalance } from "@/lib/types";
import { labelClass } from "./ui";

/** Escolha da conta bancária: cartões bem visíveis, com nome, tipo e saldo atual. */
export function AccountPicker({ accounts, value, onChange, label = "Conta bancária" }: {
  accounts: AccountBalance[]; value: string; onChange: (id: string) => void; label?: string;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => {
          const on = a.id === value;
          return (
            <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(a.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${on ? "border-brand-green bg-brand-green/10 ring-2 ring-brand-green/30" : "border-black/15 bg-white hover:bg-black/[0.03]"}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${on ? "bg-brand-green text-white" : "bg-black/[0.06] text-brand-graphite/60"}`}><Landmark className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold leading-tight">{a.name}</span>
                <span className="text-xs text-brand-graphite/60">{ACCOUNT_KIND_LABEL[a.kind]} · saldo {formatBRL(a.balance)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-brand-graphite/60">
        Não achou a conta do banco? <Link href="/gestao/cadastros" className="font-bold text-brand-green underline">Cadastre em Cadastros</Link>.
      </p>
    </div>
  );
}

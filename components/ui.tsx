import type { ReactNode } from "react";
import type { TxStatus, TxType } from "@/lib/types";
import { statusLabel } from "@/lib/constants";

export const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-brand-graphite placeholder:text-brand-graphite/40 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:opacity-60";

export const labelClass = "mb-1.5 block text-sm font-semibold text-brand-graphite";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";
export const btn = {
  primary: `${btnBase} bg-brand-green text-white hover:bg-brand-green/90`,
  cta: `${btnBase} bg-brand-lime text-brand-dark hover:brightness-95`,
  ghost: `${btnBase} border border-black/15 bg-white text-brand-graphite hover:bg-black/[0.03]`,
  danger: `${btnBase} border border-danger/30 bg-white text-danger hover:bg-danger/5`,
};

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-graphite/70">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm md:p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-graphite/70">{children}</h2>
      {aside}
    </div>
  );
}

export function StatusBadge({ status, type }: { status: TxStatus; type: TxType }) {
  const tone =
    status === "pago"
      ? "bg-brand-green/10 text-brand-green"
      : "bg-brand-amber/15 text-[#9a5a00]";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{statusLabel(status, type)}</span>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-brand-graphite/60">{children}</p>;
}

/** Valor com sinal e cor: entrada verde, saída vermelha. */
export function Money({ value, signed, type }: { value: string; signed?: boolean; type?: TxType }) {
  const color = type === "entrada" ? "text-brand-green" : type === "saida" ? "text-danger" : "";
  const sign = signed ? (type === "entrada" ? "+ " : type === "saida" ? "− " : "") : "";
  return <span className={`num whitespace-nowrap font-bold ${color}`}>{sign}{value}</span>;
}

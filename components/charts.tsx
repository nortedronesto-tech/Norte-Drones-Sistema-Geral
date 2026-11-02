import { formatBRL } from "@/lib/format";

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthShort = (key: string) => SHORT[Number(key.slice(5, 7)) - 1];

/** Barras agrupadas (entradas × saídas) por mês, em SVG puro: sem biblioteca, imprime bem. */
export function MonthlyBars({ data }: { data: { month: string; entradas: number; saidas: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.entradas, d.saidas]));
  const W = 320, H = 150, base = 128, top = 12, slot = W / data.length, bw = Math.min(16, slot / 3);
  const h = (v: number) => (v / max) * (base - top);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entradas e saídas pagas nos últimos meses" className="mx-auto w-full max-w-md">
        <line x1="0" x2={W} y1={base} y2={base} stroke="currentColor" strokeOpacity="0.15" />
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={d.month}>
              <title>{`${monthShort(d.month)}: entradas ${formatBRL(d.entradas)} · saídas ${formatBRL(d.saidas)}`}</title>
              <rect x={cx - bw - 1} y={base - h(d.entradas)} width={bw} height={h(d.entradas)} rx="3" className="fill-brand-green" />
              <rect x={cx + 1} y={base - h(d.saidas)} width={bw} height={h(d.saidas)} rx="3" className="fill-brand-amber" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" className="fill-brand-graphite/70">{monthShort(d.month)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs font-semibold text-brand-graphite/70">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-brand-green" /> Entradas</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-brand-amber" /> Saídas</span>
      </figcaption>
    </figure>
  );
}

/** Barras horizontais com valor e porcentagem (ex.: despesas por categoria). */
export function HBars({ items, tone = "amber" }: { items: { label: string; value: number; pct: number }[]; tone?: "amber" | "green" }) {
  if (!items.length) return null;
  const bar = tone === "green" ? "bg-brand-green" : "bg-brand-amber";
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{i.label}</span>
            <span className="num shrink-0 font-bold">{formatBRL(i.value)} <span className="text-xs font-medium text-brand-graphite/60">{i.pct}%</span></span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-black/[0.06]"><div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.max(2, i.pct)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

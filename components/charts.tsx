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

/** Saldo projetado em degraus (o saldo muda no dia em que há movimento). Abaixo de zero fica em vermelho. */
export function CashflowChart({ points, start, days }: { points: { date: string; balance: number }[]; start: string; days: number }) {
  const W = 320, H = 150, padX = 6, top = 10, bottom = 22;
  const dayIndex = (d: string) => Math.max(0, Math.min(days, Math.round((new Date(`${d}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000)));
  const vals = points.map((p) => p.balance);
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const span = max - min || 1;
  const x = (d: string) => padX + (dayIndex(d) / days) * (W - 2 * padX);
  const y = (v: number) => top + ((max - v) / span) * (H - top - bottom);
  const zeroY = y(0);

  // caminho em degraus: horizontal até o dia do movimento, depois vertical
  let path = `M ${x(points[0].date)} ${y(points[0].balance)}`;
  for (let i = 1; i < points.length; i++) path += ` H ${x(points[i].date)} V ${y(points[i].balance)}`;
  const neg = points.some((p) => p.balance < 0);
  const label = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  const mid = new Date(new Date(`${start}T00:00:00Z`).getTime() + (days / 2) * 86400000).toISOString().slice(0, 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saldo projetado dos próximos dias" className="mx-auto w-full max-w-md">
      <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
      <path d={path} fill="none" strokeWidth="2.5" strokeLinejoin="round" className={neg ? "stroke-danger" : "stroke-brand-green"} />
      {points.filter((p) => p.balance < 0).slice(0, 1).map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.balance)} r="4" className="fill-danger" />)}
      <text x={padX} y={H - 6} fontSize="10" className="fill-brand-graphite/60">{label(start)}</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-brand-graphite/60">{label(mid)}</text>
      <text x={W - padX} y={H - 6} textAnchor="end" fontSize="10" className="fill-brand-graphite/60">{label(points[points.length - 1].date)}</text>
    </svg>
  );
}

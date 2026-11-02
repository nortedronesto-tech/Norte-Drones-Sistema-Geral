// Contas do painel inicial e dos relatórios — PURAS (sem banco), testadas em tests/dashboard.test.ts.
export type Tx = {
  type: "entrada" | "saida";
  amount: number;
  status: "pago" | "a_pagar" | "a_receber";
  date: string; // vencimento (pendente) ou fato (pago)
  paid_at: string | null;
  category: string;
  account_id?: string;
};

const cents = (n: number) => Math.round(n * 100);
export const money = (c: number) => c / 100;

/** "2026-11" → "2026-10" (n meses para trás). */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Entradas e saídas PAGAS por mês de pagamento, dos últimos n meses (inclui o atual), em ordem cronológica. */
export function monthlySeries(rows: Tx[], currentMonth: string, n = 6) {
  const keys = Array.from({ length: n }, (_, i) => shiftMonth(currentMonth, i - (n - 1)));
  const acc = new Map(keys.map((k) => [k, { in: 0, out: 0 }]));
  for (const t of rows) {
    if (t.status !== "pago" || !t.paid_at) continue;
    const b = acc.get(t.paid_at.slice(0, 7));
    if (!b) continue;
    if (t.type === "entrada") b.in += cents(t.amount); else b.out += cents(t.amount);
  }
  return keys.map((month) => {
    const b = acc.get(month)!;
    return { month, entradas: money(b.in), saidas: money(b.out), resultado: money(b.in - b.out) };
  });
}

/** Total por categoria (maior primeiro), só do tipo pedido e só o que já foi pago. */
export function categoryTotals(rows: Tx[], type: "entrada" | "saida") {
  const m = new Map<string, number>();
  for (const t of rows) if (t.type === type && t.status === "pago") m.set(t.category, (m.get(t.category) ?? 0) + cents(t.amount));
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, c]) => ({ category, amount: money(c), pct: total ? Math.round((c / total) * 1000) / 10 : 0 }));
}

/** Pendências: atrasadas (vencimento antes de hoje), da semana (até 7 dias) e o resto. */
export function dueBuckets(rows: Tx[], status: "a_pagar" | "a_receber", today: string) {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 7);
  const week = limit.toISOString().slice(0, 10);
  const b = { overdue: { count: 0, c: 0 }, week: { count: 0, c: 0 }, later: { count: 0, c: 0 } };
  for (const t of rows) {
    if (t.status !== status) continue;
    const k = t.date < today ? "overdue" : t.date <= week ? "week" : "later";
    b[k].count++; b[k].c += cents(t.amount);
  }
  return { overdue: { count: b.overdue.count, amount: money(b.overdue.c) }, week: { count: b.week.count, amount: money(b.week.c) }, later: { count: b.later.count, amount: money(b.later.c) } };
}

/** Relatório de um mês: o que foi pago/recebido no mês e o que vence nele. */
export function monthReport(rows: Tx[], month: string) {
  const paid = rows.filter((t) => t.status === "pago" && t.paid_at?.startsWith(month));
  const inC = paid.filter((t) => t.type === "entrada").reduce((a, t) => a + cents(t.amount), 0);
  const outC = paid.filter((t) => t.type === "saida").reduce((a, t) => a + cents(t.amount), 0);
  const pending = rows.filter((t) => t.status !== "pago" && t.date.startsWith(month));
  const pendIn = pending.filter((t) => t.type === "entrada").reduce((a, t) => a + cents(t.amount), 0);
  const pendOut = pending.filter((t) => t.type === "saida").reduce((a, t) => a + cents(t.amount), 0);
  return {
    month,
    entradas: money(inC), saidas: money(outC), resultado: money(inC - outC),
    margem: inC ? Math.round(((inC - outC) / inC) * 1000) / 10 : null,
    aReceber: money(pendIn), aPagar: money(pendOut),
    receitas: categoryTotals(paid, "entrada"),
    despesas: categoryTotals(paid, "saida"),
  };
}

/** Linha CSV com ; e vírgula decimal (abre direto no Excel em português). */
export function csvLine(cols: (string | number)[]): string {
  return cols.map((c) => {
    const s = typeof c === "number" ? c.toFixed(2).replace(".", ",") : c;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";");
}

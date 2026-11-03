// Fluxo de caixa projetado — PURO, testado em tests/cashflow.test.ts.
// Parte do saldo de hoje e soma, dia a dia, as contas a pagar/receber pendentes e as recorrentes que ainda
// não viraram lançamento. Atrasadas entram no dia de hoje.
import { addDays, dueDatesUpTo } from "./recurring.ts";

export type PendingRow = { type: "entrada" | "saida"; amount: number; date: string; status: "pago" | "a_pagar" | "a_receber" };
export type RecurringRule = { type: "entrada" | "saida"; amount: number; day_of_month: number; next_due: string; end_date: string | null; active: boolean };
export type CashPoint = { date: string; balance: number; delta: number };
export type CashProjection = {
  start: number;
  end: number;
  lowest: { date: string; balance: number };
  goesNegative: boolean;
  firstNegative: string | null;
  totalIn: number;
  totalOut: number;
  points: CashPoint[]; // um por dia com movimento, mais o dia 0 e o último dia
};

const cents = (v: number) => Math.round(v * 100);

/**
 * `generatedUntil`: vencimentos até esta data já viraram lançamento pendente (estão em `pending`);
 * a partir dela, as recorrentes ainda precisam ser projetadas (padrão: hoje + 7, como o gerador).
 */
export function projectCashflow(balance: number, pending: PendingRow[], rules: RecurringRule[], today: string, days = 60, generatedUntil?: string): CashProjection {
  const horizon = addDays(today, days);
  const gen = generatedUntil ?? addDays(today, 7);
  const byDay = new Map<string, number>(); // centavos

  const add = (date: string, type: "entrada" | "saida", amount: number) => {
    const day = date < today ? today : date; // atrasada: conta como hoje
    if (day > horizon) return;
    byDay.set(day, (byDay.get(day) ?? 0) + (type === "entrada" ? cents(amount) : -cents(amount)));
  };

  for (const p of pending) if (p.status !== "pago") add(p.date, p.type, p.amount);

  for (const r of rules) {
    if (!r.active) continue;
    const { dates } = dueDatesUpTo(r.next_due, r.day_of_month, horizon, r.end_date, 24);
    for (const d of dates) if (d > gen) add(d, r.type, r.amount);
  }

  let running = cents(balance);
  const points: CashPoint[] = [{ date: today, balance: running / 100, delta: 0 }];
  let lowest = { date: today, balance: running / 100 };
  let firstNegative: string | null = running < 0 ? today : null;
  let totalIn = 0, totalOut = 0;

  for (const date of [...byDay.keys()].sort()) {
    const delta = byDay.get(date)!;
    running += delta;
    if (delta > 0) totalIn += delta; else totalOut += -delta;
    const b = running / 100;
    if (date === today) points[0] = { date, balance: b, delta: delta / 100 };
    else points.push({ date, balance: b, delta: delta / 100 });
    if (b < lowest.balance) lowest = { date, balance: b };
    if (running < 0 && firstNegative === null) firstNegative = date;
  }
  if (points[points.length - 1].date !== horizon) points.push({ date: horizon, balance: running / 100, delta: 0 });

  return { start: balance, end: running / 100, lowest, goesNegative: firstNegative !== null, firstNegative, totalIn: totalIn / 100, totalOut: totalOut / 100, points };
}

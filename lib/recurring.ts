// Datas dos lançamentos recorrentes mensais — PURAS, testadas em tests/recurring.test.ts.

/** Dias de antecedência com que o lançamento pendente aparece em "contas a pagar/receber". */
export const LEAD_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

/** Vencimento do mês, com o dia ajustado ao último dia quando o mês é mais curto (31 em fevereiro → 28/29). */
export function dueOn(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

/** Vencimento do mês seguinte ao de `current`, mantendo o dia combinado. */
export function nextMonthDue(current: string, dayOfMonth: number): string {
  const [y, m] = current.split("-").map(Number);
  return m === 12 ? dueOn(y + 1, 1, dayOfMonth) : dueOn(y, m + 1, dayOfMonth);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Vencimentos a gerar agora: de `nextDue` até o horizonte (hoje + antecedência), respeitando a data final.
 * Devolve também o próximo vencimento a guardar na regra. Recupera meses atrasados (máx. 12 por vez).
 */
export function dueDatesUpTo(nextDue: string, dayOfMonth: number, horizon: string, endDate?: string | null, max = 12): { dates: string[]; next: string } {
  const dates: string[] = [];
  let cur = nextDue;
  while (cur <= horizon && (!endDate || cur <= endDate) && dates.length < max) {
    dates.push(cur);
    cur = nextMonthDue(cur, dayOfMonth);
  }
  return { dates, next: cur };
}

/** A regra termina quando o próximo vencimento passa da data final. */
export const isFinished = (next: string, endDate?: string | null) => !!endDate && next > endDate;

export function dayFromDate(iso: string): number {
  return Number(iso.slice(8, 10));
}

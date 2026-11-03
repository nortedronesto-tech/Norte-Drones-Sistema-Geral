// Regras do painel "Saúde do sistema" — PURAS, testadas em tests/health.test.ts.

export type Level = "ok" | "warn" | "fail";
export type RunRecord = { at: string; ok: boolean; note?: string };

const HOUR = 3600 * 1000;

/** Idade de uma execução → ok / atenção / falha (nunca rodou = falha). */
export function ageLevel(at: string | null | undefined, now: Date, warnHours: number, failHours: number): Level {
  if (!at) return "fail";
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return "fail";
  const h = (now.getTime() - t) / HOUR;
  return h > failHours ? "fail" : h > warnHours ? "warn" : "ok";
}

/** "há 5 horas", "há 2 dias", "agora há pouco". */
export function ageText(at: string | null | undefined, now: Date): string {
  if (!at) return "nunca rodou";
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return "data inválida";
  const min = Math.round((now.getTime() - t) / 60000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `há ${d} dias`;
}

/** Uma execução que falhou pesa mais do que a idade. */
export function runLevel(rec: RunRecord | null | undefined, now: Date, warnHours: number, failHours: number): Level {
  if (!rec) return "fail";
  if (!rec.ok) return "fail";
  return ageLevel(rec.at, now, warnHours, failHours);
}

export const worst = (levels: Level[]): Level => (levels.includes("fail") ? "fail" : levels.includes("warn") ? "warn" : "ok");

/** Migrations que o sistema espera e a tabela/coluna que prova que cada uma rodou. */
export const MIGRATION_PROBES = [
  { id: "0007", label: "Receitas de calda", table: "spray_recipes", column: "id" },
  { id: "0008", label: "Conciliação bancária", table: "transactions", column: "reconciled_at" },
  { id: "0009", label: "Fornecedores", table: "suppliers", column: "id" },
  { id: "0010", label: "Clientes e ordens de serviço", table: "service_orders", column: "id" },
  { id: "0011", label: "OK do cliente na OS", table: "service_orders", column: "client_ok_at" },
  { id: "0013", label: "Checklist de pré-voo", table: "service_orders", column: "preflight" },
  { id: "0014", label: "Lançamentos recorrentes", table: "recurring_transactions", column: "id" },
  { id: "0015", label: "Trilha de auditoria", table: "audit_log", column: "id" },
] as const;

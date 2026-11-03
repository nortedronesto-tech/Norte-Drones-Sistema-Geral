// Lembrete de vencimentos — PURO, testado em tests/reminder.test.ts.
import { addDays } from "./recurring.ts";

export type DueRow = {
  type: "entrada" | "saida";
  status: "pago" | "a_pagar" | "a_receber";
  amount: number;
  date: string; // vencimento YYYY-MM-DD
  description: string | null;
  category: string;
};

type Buckets = { overdue: DueRow[]; today: DueRow[]; soon: DueRow[] };
export type Reminder = { pay: Buckets; receive: Buckets; counts: { overdue: number; today: number; soon: number }; hasAny: boolean; subject: string; text: string; html: string };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const label = (r: DueRow) => `${brDate(r.date)} · ${r.description || r.category} · ${brl(r.amount)}`;

function bucketize(rows: DueRow[], today: string, soonLimit: string): Buckets {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return {
    overdue: sorted.filter((r) => r.date < today),
    today: sorted.filter((r) => r.date === today),
    soon: sorted.filter((r) => r.date > today && r.date <= soonLimit),
  };
}

/** Junta o que está atrasado, vence hoje e vence nos próximos dias (só pendências). */
export function buildReminder(rows: DueRow[], today: string, soonDays = 3): Reminder {
  const soonLimit = addDays(today, soonDays);
  const pending = rows.filter((r) => r.status !== "pago");
  const pay = bucketize(pending.filter((r) => r.type === "saida"), today, soonLimit);
  const receive = bucketize(pending.filter((r) => r.type === "entrada"), today, soonLimit);
  const counts = {
    overdue: pay.overdue.length + receive.overdue.length,
    today: pay.today.length + receive.today.length,
    soon: pay.soon.length + receive.soon.length,
  };
  const hasAny = counts.overdue + counts.today + counts.soon > 0;

  const parts: string[] = [];
  if (counts.overdue) parts.push(`${counts.overdue} atrasada(s)`);
  if (counts.today) parts.push(`${counts.today} vence(m) hoje`);
  if (counts.soon) parts.push(`${counts.soon} nos próximos ${soonDays} dias`);
  const subject = `Norte Drones — contas: ${parts.join(", ")}`;

  const sections: [string, DueRow[]][] = [
    ["A PAGAR — atrasadas", pay.overdue], ["A PAGAR — vencem hoje", pay.today], [`A PAGAR — próximos ${soonDays} dias`, pay.soon],
    ["A RECEBER — atrasadas", receive.overdue], ["A RECEBER — vencem hoje", receive.today], [`A RECEBER — próximos ${soonDays} dias`, receive.soon],
  ];
  const text = sections.filter(([, l]) => l.length).map(([t, l]) => `${t}\n${l.map((r) => `• ${label(r)}`).join("\n")}`).join("\n\n");
  const html = sections.filter(([, l]) => l.length)
    .map(([t, l]) => `<h3 style="margin:18px 0 6px;color:#123f24;font-size:14px">${esc(t)}</h3><ul style="margin:0;padding-left:18px">${l.map((r) => `<li>${esc(label(r))}</li>`).join("")}</ul>`)
    .join("");
  return { pay, receive, counts, hasAny, subject, text, html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2b24"><p>Resumo diário de vencimentos da Norte Drones.</p>${html}</div>` };
}

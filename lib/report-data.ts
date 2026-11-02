import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftMonth, type Tx } from "@/lib/dashboard";

export type ReportRow = Tx & { id: string; description: string | null; account: string };

/** Lançamentos do mês: o que foi pago nele + o que vence nele e ainda está em aberto. */
export async function loadMonthRows(supabase: SupabaseClient, month: string): Promise<ReportRow[]> {
  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;
  const cols = "id, type, amount, status, date, paid_at, category, description, account_id, bank_accounts(name)";
  const [paid, pending] = await Promise.all([
    supabase.from("transactions").select(cols).eq("status", "pago").gte("paid_at", start).lt("paid_at", end).order("paid_at"),
    supabase.from("transactions").select(cols).neq("status", "pago").gte("date", start).lt("date", end).order("date"),
  ]);
  const err = paid.error ?? pending.error;
  if (err) throw new Error(err.message);
  return [...(paid.data ?? []), ...(pending.data ?? [])].map((t: Record<string, unknown>) => ({
    id: t.id as string,
    type: t.type as "entrada" | "saida",
    amount: Number(t.amount),
    status: t.status as Tx["status"],
    date: t.date as string,
    paid_at: (t.paid_at as string | null) ?? null,
    category: t.category as string,
    description: (t.description as string | null) ?? null,
    account_id: t.account_id as string,
    account: (t.bank_accounts as { name?: string } | null)?.name ?? "",
  }));
}

export const validMonth = (m: string | undefined) => (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null);

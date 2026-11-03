import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dueDatesUpTo, isFinished, LEAD_DAYS } from "@/lib/recurring";

/**
 * Cria os lançamentos pendentes das regras recorrentes que vencem nos próximos dias.
 * Serve ao cron diário (chave de serviço) e ao botão "Gerar agora" (com as permissões de quem clicou).
 * Idempotente: um mês já gerado é pulado pelo índice único do banco.
 */
export async function generateRecurring(client: SupabaseClient, today: string): Promise<{ created: number; rules: number; error?: string }> {
  const horizon = addDays(today, LEAD_DAYS);
  const { data: rules, error } = await client.from("recurring_transactions").select("*").eq("active", true).lte("next_due", horizon);
  if (error) return { created: 0, rules: 0, error: error.message };
  let created = 0;
  for (const r of rules ?? []) {
    const { dates, next } = dueDatesUpTo(r.next_due, r.day_of_month, horizon, r.end_date);
    for (const due of dates) {
      const { error: insErr } = await client.from("transactions").insert({
        type: r.type, amount: r.amount, account_id: r.account_id, category: r.category, description: r.description,
        status: r.type === "entrada" ? "a_receber" : "a_pagar", date: due, recurring_id: r.id, recurring_due: due,
        ...(r.type === "saida" && r.supplier_id ? { supplier_id: r.supplier_id } : {}),
      });
      if (!insErr) created++;
      else if (insErr.code !== "23505") return { created, rules: rules?.length ?? 0, error: insErr.message }; // 23505 = mês já gerado
    }
    if (dates.length) await client.from("recurring_transactions").update({ next_due: next, active: !isFinished(next, r.end_date) }).eq("id", r.id);
  }
  return { created, rules: rules?.length ?? 0 };
}

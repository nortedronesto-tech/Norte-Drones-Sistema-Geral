import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { addDays } from "@/lib/recurring";
import { buildReminder, type DueRow } from "@/lib/reminder";

const SOON_DAYS = 3;

/** Manda por e-mail o resumo de contas atrasadas, que vencem hoje ou nos próximos dias (só se houver algo). */
export async function sendDueReminder(admin: SupabaseClient, today: string): Promise<{ sent: boolean; reason?: string }> {
  const { data, error } = await admin
    .from("transactions")
    .select("type, status, amount, date, description, category")
    .neq("status", "pago")
    .lte("date", addDays(today, SOON_DAYS));
  if (error) return { sent: false, reason: error.message };
  const reminder = buildReminder(((data ?? []) as DueRow[]).map((r) => ({ ...r, amount: Number(r.amount) })), today, SOON_DAYS);
  if (!reminder.hasAny) return { sent: false, reason: "nada a avisar" };
  const to = process.env.BACKUP_EMAIL_TO || "nortedronesto@gmail.com";
  const r = await sendEmail({ to, subject: reminder.subject, html: reminder.html, text: reminder.text });
  return r.ok ? { sent: true } : { sent: false, reason: r.error };
}

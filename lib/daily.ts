import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayBR } from "@/lib/format";
import { recordHealth } from "@/lib/health-store";
import { generateRecurring } from "@/lib/recurring-run";
import { sendDueReminder } from "@/lib/reminder-run";

/** Rotina diária: cria os recorrentes que vencem em breve e manda o lembrete de vencimentos. Registra o resultado. */
export async function runDailyJobs(admin: SupabaseClient) {
  const today = todayBR();
  let recurring: unknown;
  let reminder: unknown;
  try { recurring = await generateRecurring(admin, today); } catch (e) { recurring = { error: e instanceof Error ? e.message : "falha" }; }
  try { reminder = await sendDueReminder(admin, today); } catch (e) { reminder = { error: e instanceof Error ? e.message : "falha" }; }
  const err = (recurring as { error?: string })?.error ?? (reminder as { reason?: string; error?: string })?.error;
  const rem = reminder as { sent?: boolean; reason?: string };
  // "nada a avisar" não é erro; falha de envio (ex.: sem chave do Resend) é.
  const reminderFailed = rem?.sent === false && rem.reason && rem.reason !== "nada a avisar";
  const ok = !err && !reminderFailed;
  await recordHealth({ daily: { at: new Date().toISOString(), ok, note: err ?? (reminderFailed ? `Lembrete: ${rem.reason}` : undefined), recurring, reminder } });
  return { recurring, reminder, ok };
}

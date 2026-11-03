"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { runDailyJobs } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/** Executa agora a rotina diária (recorrentes + lembrete), como faz a Vercel todo dia. Só o administrador. */
export async function runDailyNow(): Promise<ActionResult<{ created: number; reminder: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Falta a SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings → Environment Variables) e fazer Redeploy." };
  const r = await runDailyJobs(admin);
  revalidatePath("/gestao/sistema/saude");
  const rec = r.recurring as { created?: number; error?: string };
  const rem = r.reminder as { sent?: boolean; reason?: string; error?: string };
  if (rec?.error) return { ok: false, error: `Recorrentes: ${rec.error}` };
  return { ok: true, data: { created: rec?.created ?? 0, reminder: rem?.sent ? "e-mail de lembrete enviado" : rem?.reason ?? rem?.error ?? "sem lembrete" } };
}

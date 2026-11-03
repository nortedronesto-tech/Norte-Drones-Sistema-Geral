import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RunRecord } from "@/lib/health";

export type HealthData = { daily?: RunRecord & { recurring?: unknown; reminder?: unknown }; backup?: RunRecord & { by?: "cron" | "manual" } };
const KEY = "health";

/** Registra o resultado de uma rotina (só com a chave de serviço; falha em silêncio para nunca derrubar a rotina). */
export async function recordHealth(patch: Partial<HealthData>): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { data } = await admin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
    const next = { ...((data?.value as HealthData | undefined) ?? {}), ...patch };
    await admin.from("site_settings").upsert({ key: KEY, value: next, updated_at: new Date().toISOString() });
  } catch { /* registrar o estado é um extra */ }
}

export async function readHealth(): Promise<HealthData | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  return (data?.value as HealthData | undefined) ?? {};
}

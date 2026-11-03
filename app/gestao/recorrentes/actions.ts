"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayBR } from "@/lib/format";
import { generateRecurring } from "@/lib/recurring-run";
import { dayFromDate } from "@/lib/recurring";
import type { ActionResult } from "@/lib/types";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

function dbError(e: { message: string; code?: string }): { ok: false; error: string } {
  if (e.code === "42501") return fail("Seu nível de acesso não permite essa ação.");
  if (e.code === "42P01" || e.code === "PGRST205") return fail("Lançamentos recorrentes ainda não foram ativados (falta rodar a migration 0014 no Supabase).");
  return fail(e.message);
}

const schema = z.object({
  type: z.enum(["entrada", "saida"]),
  amount: z.number().positive("Informe um valor maior que zero").max(99_999_999),
  account_id: z.uuid("Escolha a conta"),
  category: z.string().min(1, "Escolha a categoria"),
  description: z.string().trim().max(300).optional(),
  supplier_id: z.uuid().nullable().optional(),
  first_due: date,
  end_date: date.nullable().optional(),
});
export type RecurringInput = z.input<typeof schema>;

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  if (v.end_date && v.end_date < v.first_due) return fail("A data final não pode ser antes do primeiro vencimento.");
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_transactions").insert({
    type: v.type, amount: v.amount, account_id: v.account_id, category: v.category, description: v.description || null,
    supplier_id: v.type === "saida" ? v.supplier_id ?? null : null, day_of_month: dayFromDate(v.first_due), next_due: v.first_due, end_date: v.end_date ?? null,
  });
  if (error) return dbError(error);
  revalidatePath("/gestao", "layout");
  return { ok: true };
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Regra inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_transactions").update({ active }).eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Seu nível de acesso não permite alterar.");
  revalidatePath("/gestao", "layout");
  return { ok: true };
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Regra inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_transactions").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Seu nível de acesso não permite apagar.");
  revalidatePath("/gestao", "layout");
  return { ok: true };
}

/** Gera agora os lançamentos que vencem nos próximos dias (o sistema também faz isso sozinho todo dia). */
export async function generateNow(): Promise<ActionResult<{ created: number }>> {
  const supabase = await createClient();
  const r = await generateRecurring(supabase, todayBR());
  if (r.error) return dbError({ message: r.error });
  revalidatePath("/gestao", "layout");
  return { ok: true, data: { created: r.created } };
}

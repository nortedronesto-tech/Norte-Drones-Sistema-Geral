"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayBR } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Traduz erros do Postgres/PostgREST para mensagens úteis. */
function dbError(e: { message: string; code?: string }): { ok: false; error: string } {
  if (e.code === "42501") return fail("Sem permissão. Confira se o seu e-mail está cadastrado como sócio.");
  if (e.code === "P0001") return fail(e.message); // mensagens de regra de negócio já estão em português
  if (e.code === "23514") return fail("Dados inválidos para este lançamento.");
  if (e.code === "23505") return fail("Já existe um registro com esse valor (e-mail duplicado?).");
  return fail(e.message);
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const money = z.number().positive("Informe um valor maior que zero").max(99_999_999);

const transactionSchema = z
  .object({
    type: z.enum(["entrada", "saida"]),
    amount: money,
    account_id: z.uuid("Escolha a conta"),
    category: z.string().min(1, "Escolha a categoria"),
    description: z.string().trim().max(300).optional(),
    status: z.enum(["pago", "a_pagar", "a_receber"]),
    date,
    receipt_path: z.string().max(300).optional(),
  })
  .refine(
    (v) =>
      (v.type === "entrada" && v.status !== "a_pagar") ||
      (v.type === "saida" && v.status !== "a_receber"),
    { message: "Status incompatível com o tipo do lançamento" },
  );

export type TransactionInput = z.input<typeof transactionSchema>;

export async function createTransaction(input: TransactionInput): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      type: v.type,
      amount: v.amount,
      account_id: v.account_id,
      category: v.category,
      description: v.description || null,
      status: v.status,
      date: v.date,
      receipt_path: v.receipt_path || null,
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function markPaid(id: string, paidAt?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Lançamento inválido");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: "pago", paid_at: paidAt && date.safeParse(paidAt).success ? paidAt : todayBR() })
    .eq("id", id)
    .neq("status", "pago");
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Lançamento inválido");
  const supabase = await createClient();
  const { data: row } = await supabase.from("transactions").select("receipt_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return dbError(error);
  if (row?.receipt_path) await supabase.storage.from("receipts").remove([row.receipt_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------- fundo de reserva
const withdrawalSchema = z.object({
  amount: money,
  description: z.string().trim().min(2, "Descreva para que é a retirada").max(300),
  date,
});

export async function createReserveWithdrawal(input: z.input<typeof withdrawalSchema>): Promise<ActionResult> {
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("reserve_fund_entries").insert({
    kind: "retirada",
    amount: -parsed.data.amount,
    description: parsed.data.description,
    entry_date: parsed.data.date,
  });
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteReserveEntry(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Registro inválido");
  const supabase = await createClient();
  const { error } = await supabase.from("reserve_fund_entries").delete().eq("id", id);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------- cadastros
export async function savePartnerShares(shares: { id: string; pct: number }[]): Promise<ActionResult> {
  const parsed = z
    .array(z.object({ id: z.uuid(), pct: z.number().min(0).max(100) }))
    .min(1)
    .safeParse(shares);
  if (!parsed.success) return fail("Percentuais inválidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_shares", {
    p_ids: parsed.data.map((s) => s.id),
    p_pcts: parsed.data.map((s) => s.pct),
  });
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePartner(input: { id: string; name: string; email: string }): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), name: z.string().trim().min(2, "Informe o nome"), email: z.string().trim().toLowerCase() })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.email && !z.email().safeParse(parsed.data.email).success) return fail("E-mail inválido");
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ name: parsed.data.name, email: parsed.data.email || null })
    .eq("id", parsed.data.id);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

const accountSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome da conta").max(80),
  kind: z.enum(["mei", "empresa", "caixa"]),
  partner_id: z.uuid().nullable(),
  initial_balance: z.number().min(-99_999_999).max(99_999_999),
  active: z.boolean(),
});

export async function saveAccount(input: z.input<typeof accountSchema>): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("bank_accounts").update(fields).eq("id", id)
    : await supabase.from("bank_accounts").insert(fields);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------------ sessão
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

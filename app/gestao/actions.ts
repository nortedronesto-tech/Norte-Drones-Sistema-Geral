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
  if (e.code === "42501") return fail("Seu nível de acesso não permite essa ação. Fale com o administrador.");
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
    supplier_id: z.uuid().optional(),
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
      ...(v.supplier_id ? { supplier_id: v.supplier_id } : {}),
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

const editSchema = z.object({
  id: z.uuid(),
  amount: money,
  account_id: z.uuid("Escolha a conta"),
  category: z.string().min(1, "Escolha a categoria"),
  description: z.string().trim().max(300).optional(),
  date,
  supplier_id: z.uuid().nullable().optional(),
});
export type EditTransactionInput = z.input<typeof editSchema>;

/**
 * Corrige um lançamento. Não troca tipo nem situação (para isso: marcar como pago / excluir e lançar de novo).
 * Em lançamento pago, a data editada é a do pagamento. O rateio e a reserva de uma entrada paga se recalculam sozinhos
 * (trigger do banco). Lançamento que já estava conciliado volta a "não conferido".
 */
export async function updateTransaction(input: EditTransactionInput): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase.from("transactions").select("*").eq("id", v.id).maybeSingle();
  if (curErr) return dbError(curErr);
  if (!cur) return fail("Lançamento não encontrado");
  const fields: Record<string, unknown> = {
    amount: v.amount,
    account_id: v.account_id,
    category: v.category,
    description: v.description || null,
    date: v.date,
  };
  if (cur.status === "pago") fields.paid_at = v.date;
  if (v.supplier_id !== undefined && cur.type === "saida") fields.supplier_id = v.supplier_id;
  if (cur.reconciled_at) fields.reconciled_at = null;
  const { data, error } = await supabase.from("transactions").update(fields).eq("id", v.id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Seu nível de acesso não permite editar lançamentos.");
  revalidatePath("/", "layout");
  return { ok: true };
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

// ------------------------------------------------------------- conciliação bancária
export async function setReconciled(ids: string[], on: boolean): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((i) => z.uuid().safeParse(i).success)) {
    return fail("Lançamentos inválidos");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ reconciled_at: on ? todayBR() : null })
    .in("id", ids)
    .eq("status", "pago")
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return fail("Conciliação ainda não foi ativada (falta rodar a migration 0008 no Supabase).");
    return dbError(error);
  }
  if (!data?.length) return fail("Seu nível de acesso não permite conciliar.");
  revalidatePath("/gestao/conciliacao");
  return { ok: true };
}

// ------------------------------------------------------------------ fornecedores
const supplierSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome do fornecedor").max(120),
  doc: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

function supplierError(e: { message: string; code?: string }): { ok: false; error: string } {
  if (e.code === "23505") return fail("Já existe um fornecedor com esse nome.");
  if (e.code === "42P01" || e.code === "PGRST205") return fail("Fornecedores ainda não foram ativados (falta rodar a migration 0009 no Supabase).");
  return dbError(e);
}

/** Cadastro rápido (só o nome) durante um lançamento. */
export async function createSupplier(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = supplierSchema.pick({ name: true }).safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").insert({ name: parsed.data.name }).select("id, name").single();
  if (error) return supplierError(error);
  revalidatePath("/gestao", "layout");
  return { ok: true, data: { id: data.id, name: data.name } };
}

export async function saveSupplier(input: z.input<typeof supplierSchema>): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, name, doc, phone, notes, active } = parsed.data;
  const fields = { name, doc: doc || null, phone: phone || null, notes: notes || null, active: active ?? true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("suppliers").update(fields).eq("id", id)
    : await supabase.from("suppliers").insert(fields);
  if (error) return supplierError(error);
  revalidatePath("/gestao", "layout");
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Fornecedor inválido");
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").delete().eq("id", id).select("id");
  if (error) return supplierError(error);
  if (!data?.length) return fail("Seu nível de acesso não permite apagar fornecedores.");
  revalidatePath("/gestao", "layout");
  return { ok: true };
}

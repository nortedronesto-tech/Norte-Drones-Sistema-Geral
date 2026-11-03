"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function dbError(e: { message: string; code?: string }): { ok: false; error: string } {
  if (e.code === "42501") return fail("Seu nível de acesso não permite essa ação. Fale com o administrador.");
  if (e.code === "P0001") return fail(e.message);
  if (e.code === "23505") return fail("Já existe um cliente com esse nome.");
  if (e.code === "42P01" || e.code === "PGRST205") return fail("Ordens de serviço ainda não foram ativadas (falta rodar a migration 0010 no Supabase).");
  return fail(e.message);
}

const refresh = () => revalidatePath("/gestao", "layout");

// ------------------------------------------------------------------ clientes
const clientSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome do cliente").max(120),
  doc: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  price_per_ha: z.number().min(0, "Valor por hectare inválido").max(100000).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export async function saveClient(input: z.input<typeof clientSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, name, doc, phone, city, price_per_ha, notes, active } = parsed.data;
  const fields = { name, doc: doc || null, phone: phone || null, city: city || null, price_per_ha: price_per_ha ?? null, notes: notes || null, active: active ?? true };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("clients").update(fields).eq("id", id);
    if (error) return dbError(error);
    refresh();
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase.from("clients").insert(fields).select("id").single();
  if (error) return dbError(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Cliente inválido");
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") return fail("Esse cliente tem ordens de serviço. Desative em vez de apagar.");
    return dbError(error);
  }
  if (!data?.length) return fail("Seu nível de acesso não permite apagar clientes.");
  refresh();
  return { ok: true };
}

/** Acha o cliente pelo nome (sem diferenciar maiúscula) ou cadastra: usado ao enviar OS feitas sem sinal. */
export async function ensureClient(name: string): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.pick({ name: true }).safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data: found } = await supabase.from("clients").select("id").ilike("name", parsed.data.name.replace(/[%_]/g, "\\$&")).limit(1).maybeSingle();
  if (found) return { ok: true, data: { id: found.id } };
  const { data, error } = await supabase.from("clients").insert({ name: parsed.data.name }).select("id").single();
  if (error) return dbError(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

// --------------------------------------------------------------------- OS
const osSchema = z.object({
  id: z.uuid().optional(),
  /** Chave gerada no aparelho para criar a OS: reenviar a mesma chave nunca duplica (fila sem sinal). */
  new_id: z.uuid().optional(),
  client_id: z.uuid("Escolha o cliente"),
  farm: z.string().trim().max(120).optional(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  area_ha: z.number().positive("Informe a área em hectares").max(1_000_000),
  price_per_ha: z.number().min(0, "Valor por hectare inválido").max(100000),
  crop: z.string().trim().max(80).optional(),
  target: z.string().trim().max(120).optional(),
  drone: z.string().trim().max(80).optional(),
  operator_name: z.string().trim().max(80).optional(),
  rate_l_ha: z.number().positive().max(1000).nullable().optional(),
  tank_l: z.number().positive().max(10000).nullable().optional(),
  products: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    dose: z.number().positive().max(100000),
    unit: z.enum(["L/ha", "mL/ha", "kg/ha", "g/ha"]),
    form: z.enum(["pre-diluir", "suspensao", "emulsao", "solucao", "adjuvante", "corretivo"]),
  })).max(20),
  wind_kmh: z.number().min(0).max(200).nullable().optional(),
  temp_c: z.number().min(-20).max(60).nullable().optional(),
  humidity_pct: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  preflight: z.array(z.object({ id: z.string().max(40), ok: z.boolean() })).max(30).nullable().optional(),
});
export type OsInput = z.input<typeof osSchema>;

export async function saveOS(input: OsInput): Promise<ActionResult<{ id: string }>> {
  const parsed = osSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, new_id, farm, crop, target, drone, operator_name, notes, rate_l_ha, tank_l, wind_kmh, temp_c, humidity_pct, preflight, ...rest } = parsed.data;
  const fields = {
    ...rest, farm: farm || null, crop: crop || null, target: target || null, drone: drone || null, operator_name: operator_name || null,
    notes: notes || null, rate_l_ha: rate_l_ha ?? null, tank_l: tank_l ?? null, wind_kmh: wind_kmh ?? null, temp_c: temp_c ?? null, humidity_pct: humidity_pct ?? null,
    ...(preflight !== undefined ? { preflight } : {}), // só mexe na coluna quando o checklist vem junto
  };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("service_orders").update(fields).eq("id", id).eq("status", "aberta").select("id");
    if (error) return dbError(error);
    if (!data?.length) return fail("Só dá para editar uma OS aberta.");
    refresh();
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase.from("service_orders").insert({ ...fields, ...(new_id ? { id: new_id } : {}) }).select("id").single();
  if (error) {
    if (new_id && error.code === "23505") return { ok: true, data: { id: new_id } }; // já tinha chegado (reenvio da fila)
    return dbError(error);
  }
  refresh();
  return { ok: true, data: { id: data.id } };
}

/** Conclui a OS e cria a conta a receber no financeiro (tudo na mesma transação, no banco). */
export async function closeOS(id: string, accountId: string, due: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(accountId).success) return fail("Dados inválidos");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return fail("Vencimento inválido");
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_service_order", { p_id: id, p_account: accountId, p_due: due });
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function cancelOS(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("OS inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_orders").update({ status: "cancelada" }).eq("id", id).eq("status", "aberta").select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Só dá para cancelar uma OS aberta.");
  refresh();
  return { ok: true };
}

export async function deleteOS(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("OS inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_orders").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Seu nível de acesso não permite apagar OS.");
  refresh();
  return { ok: true };
}

/** Registra (ou desfaz) que o cliente respondeu OK no WhatsApp, com a data e uma observação. */
export async function setClientOk(id: string, on: boolean, date: string, note?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("OS inválida");
  if (on && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Data inválida");
  const cleanNote = (note ?? "").trim().slice(0, 300);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .update({ client_ok_at: on ? date : null, client_ok_note: on && cleanNote ? cleanNote : null })
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return fail("Registro do OK ainda não foi ativado (falta rodar a migration 0011 no Supabase).");
    return dbError(error);
  }
  if (!data?.length) return fail("Seu nível de acesso não permite registrar.");
  refresh();
  return { ok: true };
}

/** OS abertas (para registrar o pré-voo numa delas). */
export async function listOpenOS(): Promise<ActionResult<{ id: string; number: number; label: string }[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .select("id, number, farm, clients(name)")
    .eq("status", "aberta")
    .order("service_date", { ascending: false })
    .limit(30);
  if (error) return dbError(error);
  const rows = (data ?? []) as unknown as { id: string; number: number; farm: string | null; clients: { name: string } | { name: string }[] | null }[];
  return {
    ok: true,
    data: rows.map((r) => {
      const c = Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name;
      return { id: r.id, number: r.number, label: `OS ${r.number} · ${c ?? "—"}${r.farm ? ` · ${r.farm}` : ""}` };
    }),
  };
}

const preflightSchema = z.object({
  id: z.uuid(),
  checks: z.array(z.object({ id: z.string().max(40), ok: z.boolean() })).max(30),
  wind_kmh: z.number().min(0).max(200).nullable(),
  temp_c: z.number().min(-20).max(60).nullable(),
  humidity_pct: z.number().min(0).max(100).nullable(),
});

/** Registra o resultado do pré-voo (checklist e clima) numa OS aberta. */
export async function savePreflightToOS(input: z.input<typeof preflightSchema>): Promise<ActionResult> {
  const parsed = preflightSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos");
  const { id, checks, wind_kmh, temp_c, humidity_pct } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .update({ preflight: checks.length ? checks : null, wind_kmh, temp_c, humidity_pct })
    .eq("id", id)
    .eq("status", "aberta")
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return fail("Registro do pré-voo ainda não foi ativado (falta rodar a migration 0013 no Supabase).");
    return dbError(error);
  }
  if (!data?.length) return fail("Só dá para registrar numa OS aberta.");
  refresh();
  return { ok: true };
}

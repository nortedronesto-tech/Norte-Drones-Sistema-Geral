import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccountBalance, Partner, Supplier } from "@/lib/types";

/** Contas com saldo calculado (somente lançamentos pagos/recebidos entram no saldo). */
export const getAccountBalances = cache(async (): Promise<AccountBalance[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("account_balances").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    ...a,
    initial_balance: Number(a.initial_balance),
    balance: Number(a.balance),
    to_receive: Number(a.to_receive),
    to_pay: Number(a.to_pay),
  }));
});

export const getPartners = cache(async (): Promise<Partner[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("partners").select("*").eq("active", true).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ ...p, share_pct: Number(p.share_pct) }));
});

export const getReservePct = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "reserve_pct").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : 10;
});

export const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** Fornecedores ativos. Se a migration 0009 ainda não rodou, devolve lista vazia (o resto do sistema segue normal). */
export const getSuppliers = cache(async (): Promise<Supplier[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("id, name, doc, phone, notes, active").order("name");
  if (error) return [];
  return data as Supplier[];
});

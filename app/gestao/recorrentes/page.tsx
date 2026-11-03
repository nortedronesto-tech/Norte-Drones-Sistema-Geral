import { createClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/access";
import { getAccountBalances, getSuppliers } from "@/lib/data";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { RecurringManager, type RecurringRow } from "@/components/RecurringManager";

export const metadata = { title: "Lançamentos recorrentes" };

export default async function RecurringPage() {
  const access = await requireFinanceAccess();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("id, type, amount, category, description, day_of_month, next_due, end_date, active, bank_accounts(name), suppliers(name)")
    .order("active", { ascending: false })
    .order("next_due");
  if (error) {
    return (<><PageHeader title="Lançamentos recorrentes" /><Card><EmptyState>Recorrentes ainda não estão ativos. O administrador precisa rodar a migration 0014 no Supabase.</EmptyState></Card></>);
  }
  const [accounts, suppliers] = await Promise.all([getAccountBalances(), getSuppliers()]);
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const rows: RecurringRow[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, type: r.type as "entrada" | "saida", amount: Number(r.amount), category: r.category as string,
    description: (r.description as string | null) ?? null, day_of_month: r.day_of_month as number, next_due: r.next_due as string,
    end_date: (r.end_date as string | null) ?? null, active: r.active as boolean,
    account: one(r.bank_accounts as { name: string } | { name: string }[] | null)?.name ?? "",
    supplier: one(r.suppliers as { name: string } | { name: string }[] | null)?.name ?? null,
  }));
  return (
    <>
      <PageHeader title="Lançamentos recorrentes" subtitle="Aluguel, seguro, DAS e o que se repete todo mês: o sistema cria o lançamento sozinho." />
      <RecurringManager rows={rows} accounts={accounts.filter((a) => a.active)} suppliers={suppliers.filter((s) => s.active)} canWrite={access.canWrite} canManage={access.canManage} />
    </>
  );
}

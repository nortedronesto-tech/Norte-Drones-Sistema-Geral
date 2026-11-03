import { notFound, redirect } from "next/navigation";
import { requireFinanceAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { getAccountBalances, getSuppliers } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { TransactionEditForm } from "@/components/TransactionEditForm";
import type { Transaction } from "@/lib/types";

export const metadata = { title: "Editar lançamento" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireFinanceAccess();
  if (!access.canWrite) redirect("/gestao/lancamentos");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const tx = { ...data, amount: Number(data.amount) } as Transaction & { reconciled_at?: string | null };
  const [accounts, suppliers] = await Promise.all([getAccountBalances(), getSuppliers()]);
  const activeAccounts = accounts.filter((a) => a.active || a.id === tx.account_id);
  return (
    <>
      <PageHeader title="Editar lançamento" subtitle={tx.description || tx.category} />
      <Card className="mx-auto max-w-2xl">
        <TransactionEditForm tx={tx} accounts={activeAccounts} suppliers={suppliers.filter((s) => s.active || s.id === tx.supplier_id)} />
      </Card>
    </>
  );
}

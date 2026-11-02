import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { getAccountBalances, getSuppliers } from "@/lib/data";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PhotoExpenseForm } from "@/components/PhotoExpenseForm";

export const metadata = { title: "Despesa com foto" };

export default async function PhotoExpensePage() {
  const access = await getAccess();
  if (!access?.canWrite) redirect("/gestao");
  const [allAccounts, suppliers] = await Promise.all([getAccountBalances(), getSuppliers()]);
  const accounts = allAccounts.filter((a) => a.active);
  return (
    <>
      <PageHeader title="Nova despesa com foto" subtitle="Valor, categoria, conta e foto: lance em segundos." />
      <Card className="mx-auto max-w-xl">
        {accounts.length === 0 ? (
          <EmptyState>Cadastre uma conta em <Link href="/gestao/cadastros" className="font-bold text-brand-green underline">Cadastros</Link> primeiro.</EmptyState>
        ) : (
          <PhotoExpenseForm accounts={accounts} suppliers={suppliers.filter((x) => x.active)} />
        )}
      </Card>
    </>
  );
}

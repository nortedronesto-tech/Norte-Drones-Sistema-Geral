import { getAccountBalances, getPartners, getReservePct } from "@/lib/data";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { TransactionForm } from "@/components/TransactionForm";
import Link from "next/link";

export const metadata = { title: "Novo lançamento" };

export default async function NewTransactionPage() {
  const [accounts, partners, reservePct] = await Promise.all([getAccountBalances(), getPartners(), getReservePct()]);
  const active = accounts.filter((a) => a.active);

  return (
    <>
      <PageHeader title="Novo lançamento" subtitle="Entrada ou saída, paga ou pendente." />
      <Card className="mx-auto max-w-2xl">
        {active.length === 0 ? (
          <EmptyState>Cadastre ao menos uma conta em <Link href="/cadastros" className="font-bold text-brand-green underline">Cadastros</Link> antes de lançar.</EmptyState>
        ) : (
          <TransactionForm accounts={active} partners={partners} reservePct={reservePct} />
        )}
      </Card>
    </>
  );
}

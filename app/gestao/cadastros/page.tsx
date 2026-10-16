import { getAccountBalances, getPartners, getReservePct } from "@/lib/data";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { PartnersForm } from "@/components/PartnersForm";
import { AccountsManager } from "@/components/AccountsManager";

export const metadata = { title: "Cadastros" };

export default async function RegistrationsPage() {
  const [partners, accounts, reservePct] = await Promise.all([getPartners(), getAccountBalances(), getReservePct()]);
  return (
    <>
      <PageHeader title="Cadastros" subtitle="Sócios, participação e contas." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Sócios e participação</CardTitle>
          <PartnersForm partners={partners} />
          <p className="mt-4 rounded-xl bg-black/[0.04] px-4 py-3 text-xs text-brand-graphite/70">
            Retenção do fundo de reserva: <strong>{reservePct}%</strong> de cada entrada recebida, dividida entre os sócios
            na proporção da participação (com 50/50, são 5% + 5%). Para mudar, altere a linha <code>reserve_pct</code> da
            tabela <code>settings</code> no Supabase.
          </p>
        </Card>
        <Card>
          <CardTitle>Contas</CardTitle>
          <AccountsManager accounts={accounts} partners={partners} />
        </Card>
      </div>
    </>
  );
}

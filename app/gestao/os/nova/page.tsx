import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { OSForm } from "@/components/OSForm";

export const metadata = { title: "Nova OS" };

export default async function NewOsPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const access = await getAccess();
  if (!access?.canWrite) redirect("/gestao/os");
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name, price_per_ha").eq("active", true).order("name");
  return (
    <>
      <PageHeader title="Nova ordem de serviço" subtitle="Registre a aplicação: cliente, área, calda e clima." />
      <Card className="mx-auto max-w-2xl">
        {error ? (
          <EmptyState>Ordens de serviço ainda não estão ativas. O administrador precisa rodar a migration 0010 no Supabase.</EmptyState>
        ) : (
          <>
            {(data ?? []).length === 0 && <p className="mb-3 text-sm text-brand-graphite/70">Nenhum cliente ainda: toque no <strong>+</strong> ao lado de “Cliente” para cadastrar, ou veja <Link href="/gestao/clientes" className="font-bold text-brand-green underline">Clientes</Link>.</p>}
            <OSForm clients={(data ?? []).map((c) => ({ ...c, price_per_ha: c.price_per_ha == null ? null : Number(c.price_per_ha) }))} defaultClientId={cliente} />
          </>
        )}
      </Card>
    </>
  );
}

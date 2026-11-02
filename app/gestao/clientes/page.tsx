import { createClient } from "@/lib/supabase/server";
import { getAccess, requireFinanceAccess } from "@/lib/access";
import { sum } from "@/lib/data";
import { formatBRL } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ClientsManager, type ClientRow } from "@/components/ClientsManager";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  await requireFinanceAccess();
  const access = await getAccess();
  const supabase = await createClient();
  const cl = await supabase.from("clients").select("id, name, doc, phone, city, price_per_ha, notes, active").order("name");
  if (cl.error) {
    return (<><PageHeader title="Clientes" subtitle="Quem contrata a Norte." /><Card><EmptyState>Clientes e ordens de serviço ainda não estão ativos. O administrador precisa rodar a migration 0010 no Supabase.</EmptyState></Card></>);
  }
  const os = await supabase.from("service_orders").select("client_id, total_amount, status");
  const by = new Map<string, { billed: number[]; open: number[]; n: number }>();
  for (const o of os.data ?? []) {
    if (o.status === "cancelada") continue;
    const b = by.get(o.client_id) ?? { billed: [], open: [], n: 0 };
    (o.status === "concluida" ? b.billed : b.open).push(Number(o.total_amount));
    b.n++;
    by.set(o.client_id, b);
  }
  const rows: ClientRow[] = (cl.data ?? []).map((c) => ({
    ...c, price_per_ha: c.price_per_ha == null ? null : Number(c.price_per_ha),
    billed: sum(by.get(c.id)?.billed ?? []), open: sum(by.get(c.id)?.open ?? []), orders: by.get(c.id)?.n ?? 0,
  })).sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Clientes" subtitle={`Valor por hectare de cada um. Faturado em OS concluídas: ${formatBRL(sum(rows.map((r) => r.billed)))}.`} />
      {rows.length === 0 && <p className="mb-3 text-sm text-brand-graphite/70">Nenhum cliente ainda. Cadastre abaixo ou direto na hora de abrir uma OS.</p>}
      <ClientsManager rows={rows} canWrite={access?.canWrite ?? false} canManage={access?.canManage ?? false} />
    </>
  );
}

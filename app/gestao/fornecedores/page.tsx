import { createClient } from "@/lib/supabase/server";
import { getAccess, requireFinanceAccess } from "@/lib/access";
import { sum } from "@/lib/data";
import { formatBRL } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SuppliersManager, type SupplierRow } from "@/components/SuppliersManager";
import type { Supplier } from "@/lib/types";

export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage() {
  await requireFinanceAccess();
  const access = await getAccess();
  const supabase = await createClient();
  const sup = await supabase.from("suppliers").select("id, name, doc, phone, notes, active").order("name");
  if (sup.error) {
    return (
      <>
        <PageHeader title="Fornecedores" subtitle="De quem a Norte compra." />
        <Card><EmptyState>Fornecedores ainda não estão ativos. O administrador precisa rodar a migration 0009 no Supabase.</EmptyState></Card>
      </>
    );
  }
  const tx = await supabase.from("transactions").select("supplier_id, amount, status").not("supplier_id", "is", null);
  const by = new Map<string, { total: number[]; open: number[]; count: number }>();
  for (const t of tx.data ?? []) {
    const b = by.get(t.supplier_id) ?? { total: [], open: [], count: 0 };
    (t.status === "pago" ? b.total : b.open).push(Number(t.amount));
    b.count++;
    by.set(t.supplier_id, b);
  }
  const rows: SupplierRow[] = (sup.data as Supplier[])
    .map((s) => ({ ...s, total: sum(by.get(s.id)?.total ?? []), open: sum(by.get(s.id)?.open ?? []), count: by.get(s.id)?.count ?? 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const grand = sum(rows.map((r) => r.total));

  return (
    <>
      <PageHeader title="Fornecedores" subtitle={`De quem a Norte compra. Já pago a fornecedores: ${formatBRL(grand)}.`} />
      {rows.length === 0 && <p className="mb-3 text-sm text-brand-graphite/70">Nenhum fornecedor ainda. Cadastre abaixo ou direto na hora de lançar uma saída.</p>}
      <SuppliersManager rows={rows} canWrite={access?.canWrite ?? false} canManage={access?.canManage ?? false} />
    </>
  );
}

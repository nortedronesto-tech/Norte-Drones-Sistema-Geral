import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/access";
import { monthKey, monthLabel, formatBRL, todayBR } from "@/lib/format";
import { monthReport, shiftMonth } from "@/lib/dashboard";
import { loadMonthRows, validMonth } from "@/lib/report-data";
import { shiftMonth as nextM } from "@/lib/dashboard";
import { btn, Card, CardTitle, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { HBars } from "@/components/charts";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const current = monthKey(todayBR());
  const month = validMonth(sp.mes) ?? current;
  const supabase = await createClient();
  const rows = await loadMonthRows(supabase, month);
  const r = monthReport(rows, month);

  // rateio dos sócios sobre as entradas recebidas no mês
  const incomeIds = rows.filter((t) => t.type === "entrada" && t.status === "pago").map((t) => t.id);
  const splitMap = new Map<string, number>();
  if (incomeIds.length) {
    const { data } = await supabase.from("transaction_splits").select("amount, partners(name)").in("transaction_id", incomeIds);
    for (const s of (data ?? []) as unknown as { amount: number; partners: { name: string } | { name: string }[] | null }[]) {
      const p = Array.isArray(s.partners) ? s.partners[0] : s.partners;
      const name = p?.name ?? "—";
      splitMap.set(name, Math.round(((splitMap.get(name) ?? 0) + Number(s.amount)) * 100) / 100);
    }
  }
  // gastos por fornecedor no mês (se a migration 0009 ainda não rodou, o cartão some)
  const supRes = await supabase.from("transactions").select("amount, suppliers(name)").eq("type", "saida").eq("status", "pago")
    .gte("paid_at", `${month}-01`).lt("paid_at", `${nextM(month, 1)}-01`).not("supplier_id", "is", null);
  const supMap = new Map<string, number>();
  for (const r of (supRes.error ? [] : supRes.data ?? []) as unknown as { amount: number; suppliers: { name: string } | { name: string }[] | null }[]) {
    const sp = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
    const n = sp?.name ?? "—";
    supMap.set(n, Math.round(((supMap.get(n) ?? 0) + Number(r.amount)) * 100) / 100);
  }
  const supTotal = [...supMap.values()].reduce((a, b) => a + b, 0);
  const bySupplier = [...supMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value]) => ({ label, value, pct: supTotal ? Math.round((value / supTotal) * 1000) / 10 : 0 }));
  const splits = [...splitMap.entries()].sort((a, b) => b[1] - a[1]);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i));
  const byAccount = new Map<string, { in: number; out: number }>();
  for (const t of rows.filter((x) => x.status === "pago")) {
    const a = byAccount.get(t.account) ?? { in: 0, out: 0 };
    if (t.type === "entrada") a.in += t.amount; else a.out += t.amount;
    byAccount.set(t.account, a);
  }

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`Resultado de ${monthLabel(month)}`} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        <select name="mes" defaultValue={month} className={`${inputClass} !w-auto`} aria-label="Mês">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button className={btn.ghost}>Ver</button>
        <a href={`/api/gestao/relatorio?mes=${month}`} className={btn.primary}><Download className="size-5" aria-hidden /> Baixar planilha (CSV)</a>
        <PrintButton />
      </form>

      <h2 className="mb-3 hidden text-xl font-extrabold print:block">Norte Drones — resultado de {monthLabel(month)}</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Entradas</p><p className="num mt-1 text-xl font-extrabold text-brand-green">{formatBRL(r.entradas)}</p></Card>
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Saídas</p><p className="num mt-1 text-xl font-extrabold">{formatBRL(r.saidas)}</p></Card>
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Resultado</p><p className={`num mt-1 text-xl font-extrabold ${r.resultado < 0 ? "text-danger" : "text-brand-green"}`}>{formatBRL(r.resultado)}</p>{r.margem !== null && <p className="text-xs text-brand-graphite/60">margem {r.margem}%</p>}</Card>
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Em aberto no mês</p><p className="num mt-1 text-sm font-bold">Receber {formatBRL(r.aReceber)}</p><p className="num text-sm font-bold">Pagar {formatBRL(r.aPagar)}</p></Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Receitas por categoria</CardTitle>
          {r.receitas.length ? <HBars tone="green" items={r.receitas.map((c) => ({ label: c.category, value: c.amount, pct: c.pct }))} /> : <EmptyState>Sem receitas no mês.</EmptyState>}
        </Card>
        <Card>
          <CardTitle>Despesas por categoria</CardTitle>
          {r.despesas.length ? <HBars items={r.despesas.map((c) => ({ label: c.category, value: c.amount, pct: c.pct }))} /> : <EmptyState>Sem despesas no mês.</EmptyState>}
        </Card>
        {!supRes.error && (
          <Card>
            <CardTitle>Compras por fornecedor</CardTitle>
            {bySupplier.length ? <HBars items={bySupplier} /> : <EmptyState>Nenhuma saída com fornecedor neste mês.</EmptyState>}
          </Card>
        )}
        <Card>
          <CardTitle>Por conta</CardTitle>
          {byAccount.size === 0 ? <EmptyState>Sem movimento no mês.</EmptyState> : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {[...byAccount.entries()].map(([name, v]) => (
                <li key={name} className="flex items-center justify-between py-2.5"><span className="font-semibold">{name}</span>
                  <span className="num text-right"><span className="text-brand-green">+{formatBRL(v.in)}</span> · <span>−{formatBRL(v.out)}</span></span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Rateio dos sócios no mês</CardTitle>
          {splits.length === 0 ? <EmptyState>Sem entradas recebidas no mês.</EmptyState> : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {splits.map(([name, v]) => <li key={name} className="flex items-center justify-between py-2.5"><span className="font-semibold">{name}</span><span className="num font-bold">{formatBRL(v)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

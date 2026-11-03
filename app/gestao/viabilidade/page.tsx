import { createClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/access";
import { monthKey, formatBRL, todayBR } from "@/lib/format";
import { shiftMonth } from "@/lib/dashboard";
import { calcReal } from "@/lib/viabilidade";
import { Card, CardTitle, EmptyState, inputClass, btn, PageHeader } from "@/components/ui";
import { HBars } from "@/components/charts";
import { ViabilidadeSimulador } from "@/components/ViabilidadeSimulador";

export const metadata = { title: "Viabilidade do serviço" };

const PERIODOS = [1, 3, 6, 12];

export default async function ViabilidadePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const meses = PERIODOS.includes(Number(sp.meses)) ? Number(sp.meses) : 3;
  const current = monthKey(todayBR());
  const inicio = `${shiftMonth(current, -(meses - 1))}-01`;
  const fim = `${shiftMonth(current, 1)}-01`;

  const supabase = await createClient();
  const [osRes, despRes] = await Promise.all([
    supabase.from("service_orders").select("area_ha, total_amount").eq("status", "concluida").gte("service_date", inicio).lt("service_date", fim),
    supabase.from("transactions").select("amount, category").eq("type", "saida").eq("status", "pago").gte("paid_at", inicio).lt("paid_at", fim),
  ]);
  // se a migration das OS (0010) ainda não rodou, a parte "realizado" só avisa
  const semOS = !!osRes.error;
  const os = (osRes.data ?? []) as { area_ha: number; total_amount: number }[];
  const real = calcReal({
    ha: os.reduce((s, o) => s + Number(o.area_ha), 0),
    receitaOS: os.reduce((s, o) => s + Number(o.total_amount), 0),
    despesas: ((despRes.data ?? []) as { amount: number; category: string }[]).map((d) => ({ category: d.category, amount: Number(d.amount) })),
    meses,
  });
  const temDados = real.ha > 0;
  const bom = (real.margemPct ?? 0) >= 25;

  return (
    <>
      <PageHeader title="Viabilidade do serviço" subtitle="Quanto custa cada hectare, quanto sobra e a partir de quantos hectares compensa." />

      <Card className="mb-4">
        <CardTitle>O que já aconteceu</CardTitle>
        <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
          <select name="meses" defaultValue={meses} className={`${inputClass} !w-auto`} aria-label="Período">
            {PERIODOS.map((m) => <option key={m} value={m}>{m === 1 ? "Este mês" : `Últimos ${m} meses`}</option>)}
          </select>
          <button className={btn.ghost}>Ver</button>
        </form>

        {semOS ? <EmptyState>As ordens de serviço ainda não estão ativas neste sistema.</EmptyState>
          : !temDados ? <EmptyState>Nenhuma OS concluída neste período. Conclua OS para ver o custo real por hectare.</EmptyState> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-semibold text-brand-graphite/60">Hectares aplicados</p><p className="num mt-1 text-xl font-extrabold">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(real.ha)}</p><p className="text-xs text-brand-graphite/60">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(real.haMes)} por mês</p></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-semibold text-brand-graphite/60">Preço médio cobrado</p><p className="num mt-1 text-xl font-extrabold">{formatBRL(real.precoMedio ?? 0)}</p><p className="text-xs text-brand-graphite/60">por ha</p></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-semibold text-brand-graphite/60">Custo real</p><p className="num mt-1 text-xl font-extrabold">{formatBRL(real.custoHa ?? 0)}</p><p className="text-xs text-brand-graphite/60">por ha ({formatBRL(real.totalDespesas)} no período)</p></div>
              <div className={`rounded-xl p-3 ${(real.lucroHa ?? 0) < 0 ? "bg-danger/5" : bom ? "bg-brand-green/10" : "bg-brand-amber/10"}`}><p className="text-xs font-semibold text-brand-graphite/60">Sobra por ha</p><p className={`num mt-1 text-xl font-extrabold ${(real.lucroHa ?? 0) < 0 ? "text-danger" : ""}`}>{formatBRL(real.lucroHa ?? 0)}</p>{real.margemPct !== null && <p className="text-xs text-brand-graphite/60">margem de {String(real.margemPct).replace(".", ",")}%</p>}</div>
            </div>
            {real.porCategoria.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-graphite/60">Custo por hectare, por tipo de gasto</h3>
                <HBars tone="amber" items={real.porCategoria.map((c) => ({ label: `${c.category} · ${formatBRL(c.porHa ?? 0)}/ha`, value: c.amount, pct: c.pct }))} />
              </div>
            )}
            <p className="mt-3 text-xs text-brand-graphite/60">Conta: despesas pagas no período ÷ hectares das OS concluídas. Compra de equipamento lançada como despesa pesa no custo; se for o caso, use o simulador abaixo, que divide o investimento pela vida útil.</p>
          </>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Simulador: e se eu mudar os números?</h2>
      <ViabilidadeSimulador inicial={real.precoMedio ? { precoHa: Math.round(real.precoMedio) } : undefined} />
    </>
  );
}

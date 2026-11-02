import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Camera, FileBarChart, Plus, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { getAccountBalances, getPartners, getReservePct, sum } from "@/lib/data";
import { formatBRL, formatDateShort, monthLabel, monthKey, todayBR } from "@/lib/format";
import { categoryTotals, dueBuckets, monthReport, monthlySeries, shiftMonth, type Tx } from "@/lib/dashboard";
import { HBars, MonthlyBars } from "@/components/charts";
import { ACCOUNT_KIND_LABEL } from "@/lib/constants";
import { btn, Card, CardTitle, EmptyState, Money, PageHeader, StatusBadge } from "@/components/ui";
import type { PartnerTotals, Transaction } from "@/lib/types";

export const metadata = { title: "Início" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const canWrite = (await getAccess())?.canWrite ?? false;
  const today = todayBR();

  const month = monthKey(today);
  const from = `${shiftMonth(month, -5)}-01`;
  const TXCOLS = "type, amount, status, date, paid_at, category";
  const [accounts, reservePct, partners, reserveRows, paidRes, pendingRes, recent, totalsRes] = await Promise.all([
    getAccountBalances(),
    getReservePct(),
    getPartners(),
    supabase.from("reserve_fund_entries").select("amount"),
    supabase.from("transactions").select(TXCOLS).eq("status", "pago").gte("paid_at", from),
    supabase.from("transactions").select(TXCOLS).neq("status", "pago"),
    supabase
      .from("transactions")
      .select("*, bank_accounts(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("partner_totals").select("*").order("name"),
  ]);

  const total = sum(accounts.map((a) => a.balance));
  const reserve = sum((reserveRows.data ?? []).map((r) => Number(r.amount)));
  const toReceive = sum(accounts.map((a) => a.to_receive));
  const toPay = sum(accounts.map((a) => a.to_pay));
  const toTx = (r: Record<string, unknown>) => ({ ...r, amount: Number(r.amount) }) as unknown as Tx;
  const paidRows = (paidRes.data ?? []).map(toTx);
  const pendingRows = (pendingRes.data ?? []).map(toTx);
  const series = monthlySeries(paidRows, month, 6);
  const report = monthReport(paidRows, month);
  const monthIn = report.entradas;
  const monthOut = report.saidas;
  const topExpenses = categoryTotals(paidRows.filter((t) => t.paid_at?.startsWith(month)), "saida").slice(0, 6);
  const payBuckets = dueBuckets(pendingRows, "a_pagar", today);
  const recBuckets = dueBuckets(pendingRows, "a_receber", today);
  const visibleAccounts = accounts.filter((a) => a.active || a.balance !== 0);
  const partnerTotals = (totalsRes.data ?? []) as PartnerTotals[];
  const transactions = (recent.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Resultados do negócio: saldos, mês, vencimentos e rateio entre os sócios."
        action={
          canWrite ? (
            <div className="hidden md:block">
              <Link href="/gestao/lancamentos/novo" className={btn.primary}>
                <Plus className="size-5" aria-hidden /> Novo lançamento
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Saldo total */}
      <section className="rounded-2xl bg-brand-dark p-5 text-white shadow-sm md:p-6">
        <p className="text-sm font-semibold text-white/70">Saldo total</p>
        <p className="num mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">{formatBRL(total)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-sm">
          <div>
            <p className="text-white/60">Fundo de reserva</p>
            <p className="num font-bold text-brand-lime">{formatBRL(reserve)}</p>
          </div>
          <div>
            <p className="text-white/60">Saldo sem a reserva</p>
            <p className="num font-bold">{formatBRL(total - reserve)}</p>
          </div>
        </div>
      </section>

      {/* Atalhos mobile */}
      {canWrite && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:hidden">
          <Link href="/gestao/despesa-foto" className={btn.cta}><Camera className="size-5" aria-hidden /> Despesa com foto</Link>
          <Link href="/gestao/lancamentos/novo" className={btn.ghost}><Plus className="size-5" aria-hidden /> Lançamento</Link>
        </div>
      )}

      {/* Pendências e mês */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold text-brand-graphite/60">A receber</p>
          <p className="num mt-1 text-xl font-extrabold text-brand-green">{formatBRL(toReceive)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-brand-graphite/60">A pagar</p>
          <p className="num mt-1 text-xl font-extrabold text-[#9a5a00]">{formatBRL(toPay)}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1 text-xs font-semibold text-brand-graphite/60"><ArrowDownToLine className="size-3.5" aria-hidden /> Entradas do mês</p>
          <p className="num mt-1 text-xl font-extrabold">{formatBRL(monthIn)}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1 text-xs font-semibold text-brand-graphite/60"><ArrowUpFromLine className="size-3.5" aria-hidden /> Saídas do mês</p>
          <p className="num mt-1 text-xl font-extrabold">{formatBRL(monthOut)}</p>
        </Card>
      </div>
      <p className="mt-2 text-xs text-brand-graphite/50">Mês de referência: {monthLabel(month)} (valores já pagos/recebidos).</p>

      {/* Resultado e gráficos */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle aside={<Link href={`/gestao/relatorios?mes=${month}`} className="flex items-center gap-1 text-sm font-bold text-brand-green hover:underline"><FileBarChart className="size-4" aria-hidden /> Relatório</Link>}>
            Entradas × saídas · 6 meses
          </CardTitle>
          <MonthlyBars data={series} />
          <p className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-sm">
            <TrendingUp className="size-4 text-brand-green" aria-hidden /> Resultado do mês:
            <strong className={`num ${report.resultado < 0 ? "text-danger" : "text-brand-green"}`}>{formatBRL(report.resultado)}</strong>
            {report.margem !== null && <span className="text-xs text-brand-graphite/60">margem {report.margem}%</span>}
          </p>
        </Card>
        <Card>
          <CardTitle aside={<span className="text-xs font-semibold text-brand-graphite/50">{monthLabel(month)}</span>}>Para onde foi o dinheiro</CardTitle>
          {topExpenses.length === 0 ? <EmptyState>Sem despesas pagas neste mês.</EmptyState> : <HBars items={topExpenses.map((c) => ({ label: c.category, value: c.amount, pct: c.pct }))} />}
        </Card>
      </div>

      {/* Vencimentos */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DueCard title="Contas a pagar" href="/gestao/contas-a-pagar" b={payBuckets} />
        <DueCard title="Contas a receber" href="/gestao/contas-a-receber" b={recBuckets} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* Saldo por conta */}
        <Card>
          <CardTitle>Saldo por conta</CardTitle>
          {visibleAccounts.length === 0 ? (
            <EmptyState>Nenhuma conta cadastrada. Crie em Cadastros.</EmptyState>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {visibleAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.name}{!a.active && <span className="ml-2 text-xs font-normal text-brand-graphite/50">(inativa)</span>}</p>
                    <p className="text-xs text-brand-graphite/60">
                      {ACCOUNT_KIND_LABEL[a.kind]}
                      {a.to_receive > 0 && <> · a receber {formatBRL(a.to_receive)}</>}
                      {a.to_pay > 0 && <> · a pagar {formatBRL(a.to_pay)}</>}
                    </p>
                  </div>
                  <p className={`num shrink-0 text-lg font-extrabold ${a.balance < 0 ? "text-danger" : ""}`}>{formatBRL(a.balance)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Rateio por sócio */}
        <Card>
          <CardTitle aside={<span className="text-xs font-semibold text-brand-graphite/50">reserva {reservePct}% retida antes</span>}>
            Rateio por sócio
          </CardTitle>
          {partnerTotals.length === 0 ? (
            <EmptyState>Sem sócios cadastrados.</EmptyState>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {partnerTotals.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold">{p.name} <span className="text-xs font-normal text-brand-graphite/60">· {Number(p.share_pct)}%</span></p>
                    <p className="num shrink-0 text-lg font-extrabold">{formatBRL(Number(p.split_total))}</p>
                  </div>
                  <p className="text-xs text-brand-graphite/60">Reserva retida em seu nome: {formatBRL(Number(p.reserve_total))}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-brand-graphite/50">Soma das partes de cada sócio nas entradas já recebidas, depois da reserva. {partners.length} sócios ativos.</p>
        </Card>
      </div>

      {/* Últimos lançamentos */}
      <Card className="mt-4">
        <CardTitle aside={<Link href="/gestao/lancamentos" className="text-sm font-bold text-brand-green hover:underline">Ver todos</Link>}>Últimos lançamentos</CardTitle>
        {transactions.length === 0 ? (
          <EmptyState>Nenhum lançamento ainda. Comece por “Novo lançamento”.</EmptyState>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.description || t.category}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-brand-graphite/60">
                    <span>{formatDateShort(t.date)}</span>
                    <span>{t.bank_accounts?.name}</span>
                    <StatusBadge status={t.status} type={t.type} />
                  </p>
                </div>
                <Money value={formatBRL(t.amount)} signed type={t.type} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function DueCard({ title, href, b }: { title: string; href: string; b: ReturnType<typeof dueBuckets> }) {
  const rows = [
    { label: "Atrasadas", ...b.overdue, tone: "text-danger" },
    { label: "Próximos 7 dias", ...b.week, tone: "text-[#9a5a00]" },
    { label: "Depois", ...b.later, tone: "" },
  ];
  return (
    <Card>
      <CardTitle aside={<Link href={href} className="text-sm font-bold text-brand-green hover:underline">Ver todas</Link>}>{title}</CardTitle>
      <ul className="divide-y divide-black/[0.06]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between py-2.5 text-sm">
            <span className={`flex items-center gap-1.5 font-semibold ${r.tone}`}>
              {r.label === "Atrasadas" && r.count > 0 && <AlertTriangle className="size-4" aria-hidden />}
              {r.label} <span className="text-xs font-normal text-brand-graphite/50">({r.count})</span>
            </span>
            <span className="num font-bold">{formatBRL(r.amount)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

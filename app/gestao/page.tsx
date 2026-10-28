import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Camera, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { getAccountBalances, getPartners, getReservePct, sum } from "@/lib/data";
import { formatBRL, formatDateShort, monthLabel, monthKey, todayBR } from "@/lib/format";
import { ACCOUNT_KIND_LABEL } from "@/lib/constants";
import { btn, Card, CardTitle, EmptyState, Money, PageHeader, StatusBadge } from "@/components/ui";
import type { PartnerTotals, Transaction } from "@/lib/types";

export const metadata = { title: "Início" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const canWrite = (await getAccess())?.canWrite ?? false;
  const today = todayBR();
  const monthStart = `${monthKey(today)}-01`;

  const [accounts, reservePct, partners, reserveRows, monthRows, recent, totalsRes] = await Promise.all([
    getAccountBalances(),
    getReservePct(),
    getPartners(),
    supabase.from("reserve_fund_entries").select("amount"),
    supabase.from("transactions").select("type, amount").eq("status", "pago").gte("paid_at", monthStart),
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
  const monthIn = sum((monthRows.data ?? []).filter((t) => t.type === "entrada").map((t) => Number(t.amount)));
  const monthOut = sum((monthRows.data ?? []).filter((t) => t.type === "saida").map((t) => Number(t.amount)));
  const visibleAccounts = accounts.filter((a) => a.active || a.balance !== 0);
  const partnerTotals = (totalsRes.data ?? []) as PartnerTotals[];
  const transactions = (recent.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Saldos das contas, reserva e rateio entre os sócios."
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
      <p className="mt-2 text-xs text-brand-graphite/50">Mês de referência: {monthLabel(monthKey(today))} (valores já pagos/recebidos).</p>

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

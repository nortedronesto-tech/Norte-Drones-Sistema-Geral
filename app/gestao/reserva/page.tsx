import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { getReservePct, sum } from "@/lib/data";
import { formatBRL, formatDate } from "@/lib/format";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ReserveWithdrawal } from "@/components/ReserveWithdrawal";
import { ReserveDeleteButton } from "@/components/ReserveDeleteButton";
import type { PartnerTotals, ReserveEntry } from "@/lib/types";

export const metadata = { title: "Fundo de reserva" };

const KIND_LABEL = { retencao: "Retenção", retirada: "Retirada", ajuste: "Ajuste" } as const;

export default async function ReservePage() {
  const supabase = await createClient();
  const canWrite = (await getAccess())?.canWrite ?? false;
  const [reservePct, entriesRes, totalsRes] = await Promise.all([
    getReservePct(),
    supabase
      .from("reserve_fund_entries")
      .select("*, partners(name)")
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("partner_totals").select("*").order("name"),
  ]);

  const entries = (entriesRes.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as ReserveEntry[];
  const totals = (totalsRes.data ?? []) as PartnerTotals[];

  // saldo corrente em centavos (evita erro de ponto flutuante) e depois inverte: mais recente em cima
  let running = 0;
  const withBalance = entries.map((e) => {
    running = Math.round((running + e.amount) * 100) / 100;
    return { ...e, running };
  });
  const balance = running;
  const retained = sum(entries.filter((e) => e.amount > 0).map((e) => e.amount));
  const withdrawn = sum(entries.filter((e) => e.amount < 0).map((e) => -e.amount));
  const extract = [...withBalance].reverse();

  return (
    <>
      <PageHeader title="Fundo de reserva" subtitle={`${reservePct}% de toda entrada recebida fica retido antes do rateio. Destino: bateria ou drone novo.`} />

      <section className="rounded-2xl bg-brand-dark p-5 text-white shadow-sm md:p-6">
        <p className="text-sm font-semibold text-white/70">Saldo do fundo</p>
        <p className="num mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">{formatBRL(balance)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-sm">
          <div><p className="text-white/60">Total retido</p><p className="num font-bold text-brand-lime">{formatBRL(retained)}</p></div>
          <div><p className="text-white/60">Total retirado</p><p className="num font-bold">{formatBRL(withdrawn)}</p></div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Retido por sócio</CardTitle>
          <ul className="divide-y divide-black/[0.06]">
            {totals.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="font-semibold">{p.name} <span className="text-xs font-normal text-brand-graphite/60">· {Number(p.share_pct)}%</span></span>
                <span className="num font-extrabold">{formatBRL(Number(p.reserve_total))}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Registrar retirada</CardTitle>
          {canWrite && <ReserveWithdrawal balance={balance} />}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Extrato</CardTitle>
        {extract.length === 0 ? (
          <EmptyState>Ainda sem movimentação. A primeira entrada recebida já gera a retenção.</EmptyState>
        ) : (
          <>
            {/* Mobile: cartões */}
            <ul className="divide-y divide-black/[0.06] md:hidden">
              {extract.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{e.description || KIND_LABEL[e.kind]}</p>
                      <p className="mt-0.5 text-xs text-brand-graphite/60">{formatDate(e.entry_date)} · {KIND_LABEL[e.kind]}{e.partners?.name ? ` · ${e.partners.name.split(" ")[0]}` : ""}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`num font-bold ${e.amount < 0 ? "text-danger" : "text-brand-green"}`}>{e.amount < 0 ? "− " : "+ "}{formatBRL(Math.abs(e.amount))}</p>
                      <p className="num text-xs text-brand-graphite/60">saldo {formatBRL(e.running)}</p>
                    </div>
                  </div>
                  {canWrite && e.kind !== "retencao" && <div className="mt-1 flex justify-end"><ReserveDeleteButton id={e.id} /></div>}
                </li>
              ))}
            </ul>
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs font-bold uppercase tracking-wide text-brand-graphite/60">
                    <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Tipo</th><th className="py-2 pr-3">Descrição</th><th className="py-2 pr-3">Sócio</th>
                    <th className="py-2 pr-3 text-right">Valor</th><th className="py-2 pr-3 text-right">Saldo</th><th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {extract.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="py-2.5 pr-3">{KIND_LABEL[e.kind]}</td>
                      <td className="py-2.5 pr-3">{e.description}</td>
                      <td className="py-2.5 pr-3">{e.partners?.name?.split(" ")[0] ?? "—"}</td>
                      <td className={`num py-2.5 pr-3 text-right font-bold ${e.amount < 0 ? "text-danger" : "text-brand-green"}`}>{e.amount < 0 ? "− " : "+ "}{formatBRL(Math.abs(e.amount))}</td>
                      <td className="num py-2.5 pr-3 text-right">{formatBRL(e.running)}</td>
                      <td>{canWrite && e.kind !== "retencao" && <ReserveDeleteButton id={e.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

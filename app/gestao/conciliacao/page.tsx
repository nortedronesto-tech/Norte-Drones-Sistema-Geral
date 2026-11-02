import { createClient } from "@/lib/supabase/server";
import { getAccess, requireFinanceAccess } from "@/lib/access";
import { getAccountBalances, sum } from "@/lib/data";
import { formatBRL, parseMoney } from "@/lib/format";
import { btn, Card, EmptyState, inputClass, labelClass, PageHeader } from "@/components/ui";
import { ReconcileList, type ReconRow } from "@/components/ReconcileList";

export const metadata = { title: "Conciliação bancária" };

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const accounts = (await getAccountBalances()).filter((a) => a.active);
  const conta = accounts.find((a) => a.id === sp.conta) ?? accounts[0];
  const extrato = sp.extrato ? parseMoney(sp.extrato) : null;
  const canWrite = (await getAccess())?.canWrite ?? false;

  if (!conta) {
    return (<><PageHeader title="Conciliação bancária" /><Card><EmptyState>Cadastre uma conta em Cadastros para conciliar.</EmptyState></Card></>);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, date, paid_at, category, description, reconciled_at")
    .eq("account_id", conta.id)
    .eq("status", "pago")
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  const rows: ReconRow[] = (data ?? []).map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.paid_at ?? t.date,
    label: t.description || t.category, reconciled: !!t.reconciled_at,
  }));
  const signed = (r: ReconRow) => (r.type === "entrada" ? r.amount : -r.amount);
  const conciliado = Math.round((conta.initial_balance + sum(rows.filter((r) => r.reconciled).map(signed))) * 100) / 100;
  const naoConferidos = rows.filter((r) => !r.reconciled);
  const diff = extrato === null ? null : Math.round((extrato - conciliado) * 100) / 100;

  return (
    <>
      <PageHeader title="Conciliação bancária" subtitle="Confira os lançamentos pagos com o extrato do banco, item por item." />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><label className={labelClass} htmlFor="conta">Conta</label>
          <select id="conta" name="conta" defaultValue={conta.id} className={inputClass}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className={labelClass} htmlFor="extrato">Saldo final do extrato (opcional)</label>
          <input id="extrato" name="extrato" inputMode="decimal" defaultValue={sp.extrato ?? ""} className={inputClass} placeholder="ex.: 1.250,00" /></div>
        <button className={btn.primary}>Atualizar</button>
      </form>

      {error ? (
        <Card><EmptyState>A conciliação ainda não foi ativada. O administrador precisa rodar a migration 0008 no Supabase.</EmptyState></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><p className="text-xs font-semibold text-brand-graphite/60">Saldo no sistema</p><p className="num mt-1 text-xl font-extrabold">{formatBRL(conta.balance)}</p></Card>
            <Card><p className="text-xs font-semibold text-brand-graphite/60">Saldo conferido</p><p className="num mt-1 text-xl font-extrabold text-brand-green">{formatBRL(conciliado)}</p></Card>
            <Card><p className="text-xs font-semibold text-brand-graphite/60">Falta conferir</p><p className="num mt-1 text-xl font-extrabold">{naoConferidos.length}</p></Card>
            <Card>
              <p className="text-xs font-semibold text-brand-graphite/60">Diferença p/ extrato</p>
              <p className={`num mt-1 text-xl font-extrabold ${diff === null ? "text-brand-graphite/40" : diff === 0 ? "text-brand-green" : "text-danger"}`}>{diff === null ? "—" : formatBRL(diff)}</p>
            </Card>
          </div>
          {diff !== null && (
            <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${diff === 0 ? "bg-brand-green/10 text-brand-green" : "bg-brand-amber/15 text-[#7a4a00]"}`}>
              {diff === 0 ? "Bateu! O saldo conferido é igual ao do extrato." : "Há diferença: confira se falta lançar algo que aparece no extrato ou se algum lançamento está com valor errado."}
            </p>
          )}
          <Card>
            {rows.length === 0 ? <EmptyState>Sem lançamentos pagos nesta conta.</EmptyState> : <ReconcileList rows={rows} canWrite={canWrite} />}
          </Card>
          <p className="mt-2 text-xs text-brand-graphite/50">Marque os lançamentos que você viu no extrato. Saldo conferido = saldo inicial da conta + lançamentos marcados. Mostra os 300 mais recentes.</p>
        </>
      )}
    </>
  );
}

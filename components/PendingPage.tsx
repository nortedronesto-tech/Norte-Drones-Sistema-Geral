import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { formatBRL, todayBR } from "@/lib/format";
import { sum } from "@/lib/data";
import { btn, Card, EmptyState, PageHeader } from "@/components/ui";
import { TransactionList } from "@/components/TransactionList";
import type { Transaction } from "@/lib/types";

/** Contas a pagar / a receber: pendências por vencimento, atrasadas em destaque, com "marcar como pago". */
export async function PendingPage({ kind }: { kind: "pagar" | "receber" }) {
  const status = kind === "pagar" ? "a_pagar" : "a_receber";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, bank_accounts(name)")
    .eq("status", status)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
  const today = todayBR();
  const overdue = rows.filter((t) => t.date < today);
  const rest = rows.filter((t) => t.date >= today);
  const canWrite = (await getAccess())?.canWrite ?? false;
  const nome = kind === "pagar" ? "Contas a pagar" : "Contas a receber";

  return (
    <>
      <PageHeader
        title={nome}
        subtitle={kind === "pagar" ? "O que a Norte ainda precisa pagar, por vencimento." : "O que a Norte ainda tem para receber, por vencimento."}
        action={canWrite ? <div className="hidden md:block"><Link href="/gestao/lancamentos/novo" className={btn.primary}>Novo lançamento</Link></div> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Total em aberto</p><p className="num mt-1 text-xl font-extrabold">{formatBRL(sum(rows.map((t) => t.amount)))}</p></Card>
        <Card><p className="text-xs font-semibold text-brand-graphite/60">Atrasadas ({overdue.length})</p><p className="num mt-1 text-xl font-extrabold text-danger">{formatBRL(sum(overdue.map((t) => t.amount)))}</p></Card>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState>Nada em aberto. {kind === "pagar" ? "Para registrar uma conta, crie um lançamento de saída como “A pagar”." : "Para registrar, crie um lançamento de entrada como “A receber”."}</EmptyState></Card>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Card className="border-danger/30">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-danger">Atrasadas</h2>
              <TransactionList rows={overdue} receiptUrls={{}} canWrite={canWrite} />
            </Card>
          )}
          {rest.length > 0 && (
            <Card>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-graphite/70">A vencer</h2>
              <TransactionList rows={rest} receiptUrls={{}} canWrite={canWrite} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}

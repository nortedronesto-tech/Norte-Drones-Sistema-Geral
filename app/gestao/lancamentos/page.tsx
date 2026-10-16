import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountBalances } from "@/lib/data";
import { monthKey, monthLabel, todayBR } from "@/lib/format";
import { btn, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { TransactionList } from "@/components/TransactionList";
import type { Transaction } from "@/lib/types";

export const metadata = { title: "Lançamentos" };

const PAGE = 50;

function lastMonths(n: number): string[] {
  const [y, m] = monthKey(todayBR()).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tipo = sp.tipo === "entrada" || sp.tipo === "saida" ? sp.tipo : "";
  const status = ["pago", "pendente"].includes(sp.status ?? "") ? sp.status! : "";
  const conta = sp.conta ?? "";
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : "";
  const limite = Math.min(Math.max(Number(sp.limite) || PAGE, PAGE), 500);

  const supabase = await createClient();
  const accounts = await getAccountBalances();

  let q = supabase
    .from("transactions")
    .select("*, bank_accounts(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite + 1);
  if (tipo) q = q.eq("type", tipo);
  if (status === "pago") q = q.eq("status", "pago");
  if (status === "pendente") q = q.neq("status", "pago");
  if (conta) q = q.eq("account_id", conta);
  if (mes) q = q.gte("date", `${mes}-01`).lt("date", `${nextMonth(mes)}-01`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const all = (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
  const hasMore = all.length > limite;
  const rows = all.slice(0, limite);

  // URLs assinadas (1h) para as fotos de recibo
  const paths = rows.map((r) => r.receipt_path).filter((p): p is string => !!p);
  const receiptUrls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("receipts").createSignedUrls(paths, 3600);
    signed?.forEach((s) => { if (s.path && s.signedUrl) receiptUrls[s.path] = s.signedUrl; });
  }

  const moreParams = new URLSearchParams({ ...(tipo && { tipo }), ...(status && { status }), ...(conta && { conta }), ...(mes && { mes }), limite: String(limite + PAGE) });

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle="Entradas e saídas, pagas ou pendentes."
        action={<div className="hidden md:block"><Link href="/gestao/lancamentos/novo" className={btn.primary}><Plus className="size-5" aria-hidden /> Novo</Link></div>}
      />

      <form method="get" className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <select name="tipo" defaultValue={tipo} className={inputClass} aria-label="Tipo">
          <option value="">Entradas e saídas</option>
          <option value="entrada">Só entradas</option>
          <option value="saida">Só saídas</option>
        </select>
        <select name="status" defaultValue={status} className={inputClass} aria-label="Situação">
          <option value="">Qualquer situação</option>
          <option value="pago">Pagos / recebidos</option>
          <option value="pendente">A pagar / a receber</option>
        </select>
        <select name="conta" defaultValue={conta} className={inputClass} aria-label="Conta">
          <option value="">Todas as contas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="mes" defaultValue={mes} className={inputClass} aria-label="Mês">
          <option value="">Todos os meses</option>
          {lastMonths(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button className={`${btn.ghost} col-span-2 md:col-span-1`}>Filtrar</button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>Nenhum lançamento encontrado com esses filtros.</EmptyState>
        ) : (
          <TransactionList rows={rows} receiptUrls={receiptUrls} />
        )}
      </Card>

      {hasMore && (
        <div className="mt-4 text-center">
          <Link href={`/gestao/lancamentos?${moreParams}`} className={btn.ghost}>Mostrar mais</Link>
        </div>
      )}
    </>
  );
}

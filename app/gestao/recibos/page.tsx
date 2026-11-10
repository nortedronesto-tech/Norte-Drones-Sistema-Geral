import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccess, requireFinanceAccess } from "@/lib/access";
import { monthKey, monthLabel, todayBR } from "@/lib/format";
import { btn, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { PendingTransactions } from "@/components/PendingTransactions";
import { ReceiptArchive, type ArchiveRow } from "@/components/ReceiptArchive";

export const metadata = { title: "Arquivo de recibos" };

const PAGE = 40;

function lastMonths(n: number): string[] {
  const [y, m] = monthKey(todayBR()).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
const nextMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

type Raw = { id: string; date: string; amount: number | string; type: "entrada" | "saida"; category: string; description: string | null; receipt_path: string | null; bank_accounts?: { name: string } | null; suppliers?: { name: string } | null };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const aba = sp.aba === "sem" ? "sem" : "com";
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : "";
  const busca = (sp.q ?? "").trim().slice(0, 60).replace(/[%,()]/g, " ");
  const limite = Math.min(Math.max(Number(sp.limite) || PAGE, PAGE), 400);

  const supabase = await createClient();
  const run = async (cols: string) => {
    let q = supabase.from("transactions").select(cols).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(limite + 1);
    q = aba === "com" ? q.not("receipt_path", "is", null) : q.is("receipt_path", null).eq("type", "saida");
    if (mes) q = q.gte("date", `${mes}-01`).lt("date", `${nextMonth(mes)}-01`);
    if (busca) q = q.or(`description.ilike.%${busca}%,category.ilike.%${busca}%`);
    return q;
  };
  let res = await run("id, date, amount, type, category, description, receipt_path, bank_accounts(name), suppliers(name)");
  if (res.error) res = await run("id, date, amount, type, category, description, receipt_path, bank_accounts(name)");
  if (res.error) throw new Error(res.error.message);
  const all = (res.data ?? []) as unknown as Raw[];
  const hasMore = all.length > limite;
  const page = all.slice(0, limite);

  const paths = page.map((r) => r.receipt_path).filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("receipts").createSignedUrls(paths, 3600);
    signed?.forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  const rows: ArchiveRow[] = page.map((r) => ({
    id: r.id, date: r.date, amount: Number(r.amount), type: r.type, category: r.category, description: r.description,
    supplier: r.suppliers?.name ?? null, account: r.bank_accounts?.name ?? null,
    receipt_path: r.receipt_path, receipt_url: r.receipt_path ? urls[r.receipt_path] ?? null : null,
  }));

  const canWrite = (await getAccess())?.canWrite ?? false;
  const keep = { ...(mes && { mes }), ...(busca && { q: busca }) };
  const tab = (v: "com" | "sem") => `/gestao/recibos?${new URLSearchParams({ ...keep, aba: v })}`;
  const more = new URLSearchParams({ ...keep, aba, limite: String(limite + PAGE) });

  return (
    <>
      <PageHeader title="Arquivo de recibos" subtitle="Todas as fotos de recibo e nota. Funciona sem sinal: o que você anexar fica no aparelho e vai depois." />
      <PendingTransactions />
      <div className="mb-3 flex gap-1.5">
        {([["com", "Com recibo"], ["sem", "Despesas sem recibo"]] as const).map(([v, l]) => (
          <Link key={v} href={tab(v)} className={`rounded-full border px-3.5 py-2 text-sm font-bold ${aba === v ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white"}`}>{l}</Link>
        ))}
      </div>
      <form method="get" className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <input type="hidden" name="aba" value={aba} />
        <select name="mes" defaultValue={mes} className={inputClass} aria-label="Mês">
          <option value="">Todos os meses</option>
          {lastMonths(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <input name="q" defaultValue={busca} placeholder="Buscar (descrição, categoria)" className={`${inputClass} md:col-span-2`} aria-label="Buscar" />
        <button className={btn.ghost}>Filtrar</button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState>{aba === "com" ? "Nenhum recibo guardado com esses filtros." : "Nenhuma despesa sem recibo. Tudo anexado."}</EmptyState> : <ReceiptArchive rows={rows} canWrite={canWrite} />}
      </Card>
      {hasMore && <div className="mt-4 text-center"><Link href={`/gestao/recibos?${more}`} className={btn.ghost}>Mostrar mais</Link></div>}
    </>
  );
}

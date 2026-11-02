import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { formatBRL, formatDate } from "@/lib/format";
import { sum } from "@/lib/data";
import { OS_STATUS_LABEL, type OsStatus } from "@/lib/os";
import { btn, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Ordens de serviço" };

const TONE: Record<OsStatus, string> = { aberta: "bg-brand-amber/15 text-[#9a5a00]", concluida: "bg-brand-green/10 text-brand-green", cancelada: "bg-black/[0.06] text-brand-graphite/60" };

export default async function OsListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filtro = (["aberta", "concluida", "cancelada"] as const).find((s) => s === status) ?? "";
  const access = await getAccess();
  const money = access?.canWrite ?? false; // operador não vê valores
  const supabase = await createClient();
  let q = supabase.from("service_orders").select("id, number, service_date, farm, area_ha, total_amount, status, clients(name)").order("service_date", { ascending: false }).order("number", { ascending: false }).limit(200);
  if (filtro) q = q.eq("status", filtro);
  const { data, error } = await q;
  if (error) {
    return (<><PageHeader title="Ordens de serviço" /><Card><EmptyState>Ordens de serviço ainda não estão ativas. O administrador precisa rodar a migration 0010 no Supabase.</EmptyState></Card></>);
  }
  const rows = (data ?? []) as unknown as { id: string; number: number; service_date: string; farm: string | null; area_ha: number; total_amount: number; status: OsStatus; clients: { name: string } | { name: string }[] | null }[];
  const cname = (c: (typeof rows)[number]["clients"]) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? "—";
  const abertas = rows.filter((r) => r.status === "aberta");

  return (
    <>
      <PageHeader title="Ordens de serviço" subtitle="Cada aplicação feita, com cobrança automática ao concluir."
        action={access?.canOperate ? <Link href="/gestao/os/nova" className={`${btn.primary} hidden md:inline-flex`}><Plus className="size-5" aria-hidden /> Nova OS</Link> : undefined} />
      {access?.canOperate && <Link href="/gestao/os/nova" className={`${btn.cta} mb-4 w-full md:hidden`}><Plus className="size-5" aria-hidden /> Nova OS</Link>}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {[["", "Todas"], ["aberta", "Abertas"], ["concluida", "Concluídas"], ["cancelada", "Canceladas"]].map(([v, l]) => (
          <Link key={v || "todas"} href={v ? `/gestao/os?status=${v}` : "/gestao/os"} className={`rounded-full border px-3.5 py-2 text-sm font-bold ${filtro === v ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white"}`}>{l}</Link>
        ))}
      </div>
      {money && abertas.length > 0 && !filtro && <p className="mb-3 text-sm text-brand-graphite/70">{abertas.length} OS aberta(s), {formatBRL(sum(abertas.map((r) => Number(r.total_amount))))} ainda sem cobrança.</p>}

      <Card>
        {rows.length === 0 ? <EmptyState>Nenhuma OS {filtro ? "com esse filtro" : "ainda"}. {access?.canOperate && "Abra a primeira em “Nova OS”."}</EmptyState> : (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/gestao/os/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-black/[0.02]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">OS {r.number} · {cname(r.clients)}</p>
                    <p className="text-xs text-brand-graphite/60">{formatDate(r.service_date)} · {Number(r.area_ha).toLocaleString("pt-BR")} ha{r.farm ? ` · ${r.farm}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {money && <p className="num font-bold">{formatBRL(Number(r.total_amount))}</p>}
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[r.status]}`}>{OS_STATUS_LABEL[r.status]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

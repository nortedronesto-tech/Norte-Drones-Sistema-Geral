import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { describeAudit, TABLE_LABEL, type AuditRow } from "@/lib/audit";
import { ReceiptLink } from "@/components/ReceiptViewer";
import { btn, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Trilha de auditoria" };

const PAGE = 100;
const FILTROS: [string, string][] = [["", "Tudo"], ["transactions", "Lançamentos"], ["service_orders", "OS"], ["clients", "Clientes"], ["bank_accounts", "Contas"], ["user_access", "Usuários"], ["partners", "Sócios"], ["settings", "Configuração"]];
const TONE = { INSERT: "bg-brand-green/10 text-brand-green", UPDATE: "bg-brand-amber/15 text-[#9a5a00]", DELETE: "bg-danger/10 text-danger" } as const;
const WHEN = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

type Row = AuditRow & { id: number; at: string; user_email: string | null };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tabela?: string; limite?: string }> }) {
  const access = await getAccess();
  if (!access?.canManage) redirect("/gestao");
  const sp = await searchParams;
  const tabela = Object.keys(TABLE_LABEL).includes(sp.tabela ?? "") ? sp.tabela! : "";
  const limite = Math.min(Math.max(Number(sp.limite) || PAGE, PAGE), 1000);

  const supabase = await createClient();
  let q = supabase.from("audit_log").select("id, at, user_email, table_name, subject, action, old_row, new_row, changes").order("id", { ascending: false }).limit(limite + 1);
  if (tabela) q = q.eq("table_name", tabela);
  const { data, error } = await q;
  if (error) {
    return (<><PageHeader title="Trilha de auditoria" /><Card><EmptyState>A trilha ainda não está ativa. O administrador precisa rodar a migration 0015 no Supabase.</EmptyState></Card></>);
  }
  const all = (data ?? []) as unknown as Row[];
  const rows = all.slice(0, limite);
  // fotos de recibo citadas nas linhas (o que foi lançado, trocado ou apagado): URLs assinadas por 1h
  const pathsOf = (r: Row) => {
    if (r.table_name !== "transactions") return [] as string[];
    const out = new Set<string>();
    for (const row of [r.new_row, r.old_row]) { const p = row?.receipt_path; if (typeof p === "string" && p) out.add(p); }
    const ch = r.changes?.receipt_path;
    for (const p of [ch?.de, ch?.para]) if (typeof p === "string" && p) out.add(p);
    return [...out];
  };
  const urls: Record<string, string> = {};
  const wanted = [...new Set(rows.flatMap(pathsOf))];
  if (wanted.length) {
    const { data: signed } = await supabase.storage.from("receipts").createSignedUrls(wanted, 3600);
    signed?.forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; });
  }
  const more = new URLSearchParams({ ...(tabela && { tabela }), limite: String(limite + PAGE) });

  return (
    <>
      <PageHeader title="Trilha de auditoria" subtitle="Quem criou, alterou ou apagou o quê, com o antes e o depois. Só administrador e sócio veem." />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTROS.map(([v, l]) => (
          <Link key={v || "tudo"} href={v ? `/gestao/auditoria?tabela=${v}` : "/gestao/auditoria"} className={`rounded-full border px-3.5 py-2 text-sm font-bold ${tabela === v ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white"}`}>{l}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? <EmptyState>Nada registrado ainda{tabela ? " para este filtro" : ""}. A trilha começa a valer a partir da ativação.</EmptyState> : (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((r) => {
              const d = describeAudit(r);
              return (
                <li key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold leading-snug">{d.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[r.action]}`}>{r.action === "INSERT" ? "criou" : r.action === "UPDATE" ? "alterou" : "apagou"}</span>
                  </div>
                  {d.lines.length > 0 && <ul className="mt-1 space-y-0.5 text-sm text-brand-graphite/85">{d.lines.map((l, i) => <li key={i}>• {l}</li>)}</ul>}
                  {pathsOf(r).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {pathsOf(r).map((p, n, arr) => urls[p] ? <ReceiptLink key={p} path={p} url={urls[p]} label={arr.length > 1 ? `Ver recibo ${n + 1}` : "Ver recibo"} /> : null)}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-brand-graphite/55">{WHEN.format(new Date(r.at))} · {r.user_email ?? "Sistema (rotina automática)"}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {all.length > limite && <div className="mt-4 text-center"><Link href={`/gestao/auditoria?${more}`} className={btn.ghost}>Mostrar mais</Link></div>}
    </>
  );
}

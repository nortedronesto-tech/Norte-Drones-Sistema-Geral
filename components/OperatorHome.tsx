import Link from "next/link";
import { ClipboardList, Calculator, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { btn, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ModuleGrid } from "@/components/ModuleGrid";
import { ClimaWidget } from "@/components/ClimaWidget";
import { InstallApp } from "@/components/InstallApp";

/** Início do Operador: o que ele precisa no campo (nova OS, calda, OS abertas), sem nada de financeiro. */
export async function OperatorHome({ name }: { name: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_orders")
    .select("id, number, service_date, farm, area_ha, clients(name)")
    .eq("status", "aberta")
    .order("service_date", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as unknown as { id: string; number: number; service_date: string; farm: string | null; area_ha: number; clients: { name: string } | { name: string }[] | null }[];
  const cname = (c: (typeof rows)[number]["clients"]) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? "—";

  return (
    <>
      <PageHeader title={`Olá${name ? `, ${name.split(" ")[0]}` : ""}`} subtitle="O que você precisa no campo, em um toque." />
      <InstallApp />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link href="/gestao/os/nova" className={`${btn.cta} py-5 text-lg`}><Plus className="size-6" aria-hidden /> Nova OS</Link>
        <Link href="/gestao/campo/pulverizacao" className={`${btn.primary} py-5 text-lg`}><Calculator className="size-6" aria-hidden /> Calculadora de calda</Link>
      </div>
      <Card className="mb-5"><CardTitle>Clima agora</CardTitle><ClimaWidget title="Ver o clima para aplicar" /></Card>
      <Card className="mb-5">
        <CardTitle aside={<Link href="/gestao/os" className="text-sm font-bold text-brand-green hover:underline">Ver todas</Link>}>OS abertas</CardTitle>
        {rows.length === 0 ? <EmptyState>Nenhuma OS aberta. Toque em “Nova OS” para registrar uma aplicação.</EmptyState> : (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/gestao/os/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">
                  <ClipboardList className="size-5 shrink-0 text-brand-green" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">OS {r.number} · {cname(r.clients)}</span>
                    <span className="text-xs text-brand-graphite/60">{formatDate(r.service_date)} · {Number(r.area_ha).toLocaleString("pt-BR")} ha{r.farm ? ` · ${r.farm}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ModuleGrid role="operador" />
    </>
  );
}

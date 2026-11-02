import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { getAccountBalances } from "@/lib/data";
import { formatBRL, formatDate, todayBR } from "@/lib/format";
import { defaultDue, OS_STATUS_LABEL, osCalda, osText, osTotal, type OsData } from "@/lib/os";
import { recipeText, type Product } from "@/lib/calda";
import { getSiteContent } from "@/lib/content-store";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { OSActions } from "@/components/OSActions";
import { OSForm, type OsInitial } from "@/components/OSForm";

export const metadata = { title: "Ordem de serviço" };

export default async function OsDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();
  const { data: o } = await supabase.from("service_orders").select("*, clients(name, phone)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const access = await getAccess();
  const client = (Array.isArray(o.clients) ? o.clients[0] : o.clients) as { name: string; phone: string | null } | null;
  const products = (Array.isArray(o.products) ? o.products : []) as Product[];
  const n = (v: unknown) => (v == null ? null : Number(v));

  if (editar && o.status === "aberta" && access?.canWrite) {
    const { data: clients } = await supabase.from("clients").select("id, name, price_per_ha").eq("active", true).order("name");
    const initial: OsInitial = {
      id: o.id, client_id: o.client_id, farm: o.farm, service_date: o.service_date, area_ha: Number(o.area_ha), price_per_ha: Number(o.price_per_ha),
      crop: o.crop, target: o.target, drone: o.drone, operator_name: o.operator_name, rate_l_ha: n(o.rate_l_ha), tank_l: n(o.tank_l), products,
      wind_kmh: n(o.wind_kmh), temp_c: n(o.temp_c), humidity_pct: n(o.humidity_pct), notes: o.notes,
    };
    return (
      <>
        <PageHeader title={`Editar OS ${o.number}`} subtitle={client?.name} />
        <Card className="mx-auto max-w-2xl"><OSForm clients={(clients ?? []).map((c) => ({ ...c, price_per_ha: n(c.price_per_ha) }))} initial={initial} /></Card>
      </>
    );
  }

  const data: OsData = {
    number: o.number, client: client?.name ?? "—", farm: o.farm, date: o.service_date, areaHa: Number(o.area_ha), pricePerHa: Number(o.price_per_ha),
    crop: o.crop, target: o.target, drone: o.drone, operator: o.operator_name, rateLHa: n(o.rate_l_ha), tankL: n(o.tank_l), products,
    windKmh: n(o.wind_kmh), tempC: n(o.temp_c), humidityPct: n(o.humidity_pct), notes: o.notes,
    clientOkAt: (o.client_ok_at as string | null | undefined) ?? null,
  };
  const total = osTotal(data.areaHa, data.pricePerHa);
  const calda = osCalda(data);
  const accounts = (await getAccountBalances()).filter((a) => a.active);
  const { contacts: c } = await getSiteContent();
  const pdfContacts = { phone: c.phone || undefined, email: c.email || undefined, instagram: c.instagramHandle || undefined, address: c.address || undefined };
  const dl = (label: string, value: string | null | undefined) => value ? <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-brand-graphite/60">{label}</dt><dd className="text-right font-semibold">{value}</dd></div> : null;

  return (
    <>
      <PageHeader title={`OS ${o.number} · ${data.client}`} subtitle={`${OS_STATUS_LABEL[o.status as keyof typeof OS_STATUS_LABEL]} · ${formatDate(o.service_date)}`} />
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="hidden text-lg font-extrabold print:block">Norte Drones — Ordem de serviço nº {o.number}</p>
        <Card>
          <CardTitle>Serviço</CardTitle>
          <dl className="divide-y divide-black/[0.06]">
            {dl("Cliente", data.client)}{dl("Fazenda / talhão", data.farm)}{dl("Data", formatDate(o.service_date))}
            {dl("Área aplicada", `${data.areaHa.toLocaleString("pt-BR")} ha`)}
            {dl("Valor", `${data.areaHa.toLocaleString("pt-BR")} ha × ${formatBRL(data.pricePerHa)} = ${formatBRL(total)}`)}
            {dl("Cultura", data.crop)}{dl("Alvo / praga", data.target)}{dl("Drone", data.drone)}{dl("Operador", data.operator)}
            {dl("Clima", [data.windKmh != null && `vento ${data.windKmh} km/h`, data.tempC != null && `${data.tempC} °C`, data.humidityPct != null && `umidade ${data.humidityPct}%`].filter(Boolean).join(" · "))}
            {dl("Observações", data.notes)}{dl("Autorização do cliente", data.clientOkAt ? `OK em ${formatDate(data.clientOkAt)}` : "ainda sem OK")}
          </dl>
        </Card>
        {products.length > 0 && (
          <Card>
            <CardTitle>Produtos e calda</CardTitle>
            <ul className="space-y-1 text-sm">{products.map((p, i) => <li key={i}>• <strong>{p.name}</strong>: {p.dose.toLocaleString("pt-BR")} {p.unit}</li>)}</ul>
            {calda && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/[0.04] p-3 font-sans text-sm">{recipeText(`OS ${o.number}`, calda.input, calda.result)}</pre>}
          </Card>
        )}
        <OSActions osId={o.id} status={o.status} accounts={accounts} due={defaultDue(todayBR())} text={osText(data)} total={formatBRL(total)} data={data} contacts={pdfContacts} clientPhone={client?.phone ?? null} clientOkNote={(o.client_ok_note as string | null | undefined) ?? null}
          canWrite={access?.canWrite ?? false} canManage={access?.canManage ?? false} />
      </div>
    </>
  );
}

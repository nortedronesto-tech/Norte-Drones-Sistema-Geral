// Regras da ordem de serviço (OS) — PURAS, testadas em tests/os.test.ts.
import { calcCalda, recipeText, type Product } from "./calda.ts";

/** Valor padrão por hectare quando o cliente não tem um valor próprio (média da empresa; editável em cada OS). */
export const DEFAULT_PRICE_PER_HA = 100;

export type OsStatus = "aberta" | "concluida" | "cancelada";
export const OS_STATUS_LABEL: Record<OsStatus, string> = { aberta: "Aberta", concluida: "Concluída", cancelada: "Cancelada" };

/** área × valor por ha, em centavos exatos (evita 0,1 + 0,2). */
export function osTotal(areaHa: number, pricePerHa: number): number {
  if (!(areaHa > 0) || !(pricePerHa >= 0)) return 0;
  return Math.round(areaHa * pricePerHa * 100) / 100;
}

/** Vencimento padrão da cobrança: hoje + n dias (YYYY-MM-DD). */
export function defaultDue(today: string, days = 15): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type OsData = {
  number: number;
  client: string;
  farm?: string | null;
  date: string; // YYYY-MM-DD
  areaHa: number;
  pricePerHa: number;
  crop?: string | null;
  target?: string | null;
  drone?: string | null;
  operator?: string | null;
  rateLHa?: number | null;
  tankL?: number | null;
  products: Product[];
  windKmh?: number | null;
  tempC?: number | null;
  humidityPct?: number | null;
  notes?: string | null;
};

const n = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
const brDate = (iso: string) => iso.split("-").reverse().join("/");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Plano de calda da OS (por tanque), ou null se faltarem volume/tanque/produtos. */
export function osCalda(o: OsData) {
  if (!o.rateLHa || !o.tankL) return null;
  const input = { areaHa: o.areaHa, rateLHa: o.rateLHa, tankL: o.tankL, products: o.products };
  const r = calcCalda(input);
  return r.ok ? { input, result: r } : null;
}

/** Texto pronto para o WhatsApp: resumo do serviço feito, sem valores internos de calda se não houver. */
export function osText(o: OsData, withPrice = true): string {
  const lines = [
    `*Norte Drones — Ordem de serviço nº ${o.number}*`,
    `Cliente: ${o.client}${o.farm ? ` · ${o.farm}` : ""}`,
    `Data: ${brDate(o.date)} · Área aplicada: ${n(o.areaHa)} ha`,
  ];
  if (o.crop || o.target) lines.push(`Cultura/alvo: ${[o.crop, o.target].filter(Boolean).join(" · ")}`);
  if (o.drone || o.operator) lines.push(`Drone: ${o.drone || "—"} · Operador: ${o.operator || "—"}`);
  const clima = [o.windKmh != null && `vento ${n(o.windKmh, 1)} km/h`, o.tempC != null && `${n(o.tempC, 1)} °C`, o.humidityPct != null && `umidade ${n(o.humidityPct, 0)}%`].filter(Boolean);
  if (clima.length) lines.push(`Clima: ${clima.join(" · ")}`);
  if (o.products.length) {
    lines.push("Produtos (receituário):");
    for (const p of o.products) lines.push(`• ${p.name}: ${n(p.dose, 3)} ${p.unit}`);
  }
  const c = osCalda(o);
  if (c) lines.push(`Calda: ${n(o.rateLHa ?? 0)} L/ha · tanque ${n(o.tankL ?? 0)} L · ${c.result.tankCount} tanque(s)`);
  if (withPrice) lines.push(`Valor: ${n(o.areaHa)} ha × ${brl(o.pricePerHa)} = *${brl(osTotal(o.areaHa, o.pricePerHa))}*`);
  if (o.notes) lines.push(`Obs.: ${o.notes}`);
  return lines.join("\n");
}

export { recipeText };

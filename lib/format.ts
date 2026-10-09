import { TIMEZONE } from "./constants";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number) => brl.format(v);

/** "2026-10-06" -> "06/10/2026" (sem passar por Date, para não deslocar o fuso). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Hoje em Palmas/TO como YYYY-MM-DD, independentemente do fuso do aparelho/servidor. */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Converte o que o usuário digita em número: "1.234,56", "1234,56", "1234.56", "R$ 80".
 * Retorna null se não for um valor válido.
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // o separador que aparece por último é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  } else if (lastDot > -1) {
    // "1.234" (milhar) vs "12.5" (decimal): 3 dígitos após o ponto = milhar
    const after = s.length - lastDot - 1;
    if (after === 3 && s.indexOf(".") === lastDot) s = s.replace(".", "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${names[m - 1]} de ${y}`;
}

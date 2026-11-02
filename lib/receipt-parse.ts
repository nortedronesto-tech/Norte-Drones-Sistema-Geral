// Extrai valor, data, estabelecimento e categoria do TEXTO de uma nota/cupom lido por OCR.
// Puro (sem rede/IA): testável em tests/receipt-parse.test.ts. Notas fiscais brasileiras têm um padrão
// estável ("VALOR TOTAL R$", "CNPJ", data dd/mm/aaaa), o que torna regras simples bem eficazes.
import { parseBRNumber, parseSpokenEntry } from "./text-parse.ts";

export type ReceiptText = {
  tipo: "saida" | "entrada" | null;
  amount: number | null;
  date: string | null;
  description: string | null;
  category: string | null;
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// OCR confunde letras com dígitos dentro de valores: "1O5,3O" → "105,30"
const fixDigits = (s: string) => s.replace(/(?<=\d)[OoQD](?=[\d,.]|\b)/g, "0").replace(/(?<=\d)[lI|](?=[\d,.])/g, "1").replace(/(?<=[\d,.])[Ss](?=\d)/g, "5");

const MONEY = /(?<![\d/.-])(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?![\d/-])/g;

/** Linhas "TOTAL" em ordem de confiança (a primeira que existir vence). */
const TOTAL_PATTERNS: RegExp[] = [
  /valor\s*a\s*pagar|total\s*a\s*pagar|a\s*pagar/,
  /valor\s*total|vlr\.?\s*total|total\s*geral|total\s*da\s*nota|total\s*nf/,
  /total\s*r\$|total\s*\(?r\$/,
  /(?<!sub)total/,
  /valor\s*pago|valor\s*cobrado|valor\s*:/,
];

function amountOf(line: string): number[] {
  const out: number[] = [];
  for (const m of fixDigits(line).matchAll(MONEY)) {
    const v = parseBRNumber(m[1]);
    if (v !== null && v > 0 && v < 10_000_000) out.push(v);
  }
  return out;
}

export function findTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const re of TOTAL_PATTERNS) {
    const found: number[] = [];
    lines.forEach((line, i) => {
      if (!re.test(strip(line)) || /subtotal|sub-total/.test(strip(line))) return;
      const here = amountOf(line);
      // o valor às vezes cai na linha seguinte
      const vals = here.length ? here : amountOf(lines[i + 1] ?? "");
      if (vals.length) found.push(vals[vals.length - 1]);
    });
    if (found.length) return Math.max(...found);
  }
  // sem linha de total: o maior valor com centavos do papel (costuma ser o total)
  const all = amountOf(text);
  return all.length ? Math.max(...all) : null;
}

export function findReceiptDate(text: string, today: string): string | null {
  const [ty, tm, td] = today.split("-").map(Number);
  const todayNum = ty * 10000 + tm * 100 + td;
  for (const m of fixDigits(text).matchAll(/(?<!\d)(\d{2})[/.-](\d{2})[/.-](\d{4}|\d{2})(?!\d)/g)) {
    const d = +m[1], mo = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const t = new Date(Date.UTC(y, mo - 1, d));
    const valid = t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
    const num = y * 10000 + mo * 100 + d;
    if (valid && num <= todayNum && y >= ty - 3) return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

const SKIP_LINE = /cnpj|cpf|ie:|insc|danfe|nfc-?e|nf-?e|nota fiscal|cupom|documento auxiliar|consumidor|via do|www\.|http|tel[.:]|fone|rua |av\.|avenida|cep|\d{2}[/.-]\d{2}[/.-]\d{2,4}|r\$|total|item|qtd|unit|^[\d\s.,:/-]+$/i;

export function findMerchant(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const letters = (line.match(/[A-Za-zÀ-ú]/g) ?? []).length;
    if (letters < 4 || SKIP_LINE.test(line)) continue;
    const clean = line.replace(/[^A-Za-zÀ-ú0-9 &.'-]/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length >= 4) return clean.slice(0, 80);
  }
  return null;
}

export function parseReceiptText(text: string, today: string): ReceiptText {
  const merchant = findMerchant(text);
  const guess = parseSpokenEntry(text, today); // só aproveita tipo e categoria
  const title = merchant ? merchant.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null;
  return {
    tipo: guess.tipo ?? (/nota fiscal|cupom|nfc|danfe|recibo|comprovante/.test(strip(text)) ? "saida" : null),
    amount: findTotal(text),
    date: findReceiptDate(text, today),
    description: title,
    category: guess.category,
  };
}

// Interpretador de frases em português para lançamentos financeiros — PURO (sem rede, sem IA),
// por isso funciona sem chave, sem internet de IA e é testável (tests/text-parse.test.ts).
// Serve para: ditado por voz, texto digitado e o texto lido de uma foto por OCR.
//
//   "Paguei 150 reais de diesel no posto Ipiranga ontem"
//   "Recebi três mil e quinhentos reais da Fazenda Boa Vista, serviço de 40 hectares"
//   "Nota fiscal de 89,90 do mercado, vence dia 15"

export type SpokenEntry = {
  tipo: "saida" | "entrada" | null;
  amount: number | null;
  date: string | null; // AAAA-MM-DD
  /** "pendente" = a pagar (saída) ou a receber (entrada) */
  status: "pago" | "pendente" | null;
  category: string | null;
  description: string | null;
};

// ------------------------------------------------------------------ utilidades
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "1.234,56", "1234,56", "1234.56", "150" → número (null se não for válido). */
export function parseBRNumber(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  } else if (lastDot > -1) {
    const after = s.length - lastDot - 1;
    if (after === 3) s = s.replace(/\./g, ""); // 1.234 = mil duzentos e trinta e quatro
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ------------------------------------------------------------------ números por extenso
const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};
const isNumWord = (w: string) => w in UNITS || w === "mil" || w === "milhao" || w === "milhoes";

/** ["tres","mil","e","quinhentos"] → 3500 */
export function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const t of tokens) {
    if (t === "e") continue;
    if (t in UNITS) {
      current += UNITS[t];
      seen = true;
    } else if (t === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (t === "milhao" || t === "milhoes") {
      total += (current || 1) * 1_000_000;
      current = 0;
      seen = true;
    } else return null;
  }
  return seen ? total + current : null;
}

// ------------------------------------------------------------------ valor
const CURRENCY_WORD = /^(reais|real|conto|contos|pila|pilas)$/;
type Hit = { value: number; start: number; end: number; marked: boolean };

function findAmount(original: string): Hit | null {
  const hits: Hit[] = [];

  // 1) "R$ 1.234,56"  /  "1234,56 reais"  /  "150 conto(s)"
  for (const m of original.matchAll(/r\$\s*([\d][\d.,]*)/gi)) {
    const v = parseBRNumber(m[1]);
    if (v !== null) hits.push({ value: v, start: m.index!, end: m.index! + m[0].length, marked: true });
  }
  for (const m of original.matchAll(/(\d[\d.,]*)\s*(?:mil\b)?(?:\s*e\s*(\d[\d.,]*))?\s*(reais|real|contos?|pilas?)\b/gi)) {
    // "3 mil e 500 reais" → 3500 ; "150 reais" → 150
    const hasMil = /mil\b/i.test(m[0]);
    const a = parseBRNumber(m[1]);
    if (a === null) continue;
    let v = hasMil ? a * 1000 : a;
    if (hasMil && m[2]) v += parseBRNumber(m[2]) ?? 0;
    else if (!hasMil && m[2]) continue; // "10 e 20 reais": ambíguo
    hits.push({ value: v, start: m.index!, end: m.index! + m[0].length, marked: true });
  }
  // "89 reais e 90 centavos" / "89 reais e 90" / "89 e 90 centavos" → 89,90
  for (const m of original.matchAll(/(\d[\d.]*)\s*(?:reais|real)?\s*e\s*(\d{1,2})\s*(centavos?)?(?!\d)/gi)) {
    const withCoin = /reais|real/i.test(m[0]);
    if (!withCoin && !m[3]) continue; // "150 e 50" sem moeda nem "centavos" é tratado mais abaixo
    const a = parseBRNumber(m[1]);
    if (a === null) continue;
    const cents = Number(m[2]);
    const v = Math.round((a + (m[2].length === 1 && !m[3] ? cents * 10 : cents) / 100) * 100) / 100;
    for (let k = hits.length - 1; k >= 0; k--) if (hits[k].start >= m.index! && hits[k].end <= m.index! + m[0].length) hits.splice(k, 1);
    hits.push({ value: v, start: m.index!, end: m.index! + m[0].length, marked: true });
  }
  // "3 mil" sem moeda
  for (const m of original.matchAll(/(\d[\d.,]*)\s*mil\b(?:\s*e\s*(\d[\d.,]*))?/gi)) {
    const a = parseBRNumber(m[1]);
    if (a === null) continue;
    const v = a * 1000 + (m[2] ? parseBRNumber(m[2]) ?? 0 : 0);
    if (!hits.some((h) => h.start <= m.index! && h.end >= m.index! + m[0].length)) {
      hits.push({ value: v, start: m.index!, end: m.index! + m[0].length, marked: false });
    }
  }

  // 2) por extenso: "cento e cinquenta reais [e vinte centavos]"
  const words = [...original.matchAll(/[^\s,.;:!?()]+/g)].map((m) => ({ norm: strip(m[0]), start: m.index!, end: m.index! + m[0].length }));
  for (let i = 0; i < words.length; i++) {
    if (!CURRENCY_WORD.test(words[i].norm)) continue;
    let j = i - 1;
    const run: string[] = [];
    while (j >= 0 && (isNumWord(words[j].norm) || (words[j].norm === "e" && run.length > 0))) {
      run.unshift(words[j].norm);
      j--;
    }
    while (run[0] === "e") run.shift();
    const reais = run.length ? wordsToNumber(run) : null;
    if (reais === null) continue;
    let end = words[i].end;
    let cents = 0;
    if (words[i + 1]?.norm === "e") {
      const c: string[] = [];
      let k = i + 2;
      while (k < words.length && isNumWord(words[k].norm)) c.push(words[k++].norm);
      if (c.length && /^centavos?$/.test(words[k]?.norm ?? "")) {
        cents = (wordsToNumber(c) ?? 0) / 100;
        end = words[k].end;
      }
    }
    hits.push({ value: Math.round((reais + cents) * 100) / 100, start: words[j + 1].start, end, marked: true });
  }

  if (hits.length) {
    // prefere a que vem depois de "total"/"valor"; senão a primeira marcada; senão a maior
    const marked = hits.filter((h) => h.marked);
    const pool = marked.length ? marked : hits;
    const afterTotal = pool.find((h) => /(total|valor|ficou|deu)\D{0,12}$/i.test(original.slice(Math.max(0, h.start - 16), h.start)));
    return afterTotal ?? pool.sort((a, b) => a.start - b.start)[0];
  }

  // 3) sem moeda: número com centavos ("89,90") ou um número solto que não seja data/litro/km…
  const NOT_AMOUNT_AFTER = /^\s*(litros?|l\b|km|quilometros?|ha\b|hectares?|kg|quilos?|horas?|h\b|dias?|%|por cento|vezes|unidades?|und|anos?|meses|de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/i;
  const nums: Hit[] = [];
  for (const m of original.matchAll(/(?<![\d/.-])(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+)(?![\d/-])/g)) {
    const after = strip(original.slice(m.index! + m[0].length, m.index! + m[0].length + 14));
    const before = strip(original.slice(Math.max(0, m.index! - 5), m.index!));
    if (NOT_AMOUNT_AFTER.test(after) || /dia\s*$/.test(before)) continue;
    const v = parseBRNumber(m[0]);
    if (v !== null && v > 0) nums.push({ value: v, start: m.index!, end: m.index! + m[0].length, marked: false });
  }
  const withCents = nums.find((n) => /,\d{1,2}$/.test(original.slice(n.start, n.end)));
  if (withCents) return withCents;
  if (nums.length === 1) return nums[0];

  // 3b) "150 e 50" (só dígitos, sem moeda): quem fala assim quer dizer 150,50
  const loose = /(?<![\d/.,-])(\d{1,6})\s+e\s+(\d{2})(?![\d/,.-])/.exec(original);
  if (loose && !NOT_AMOUNT_AFTER.test(strip(original.slice(loose.index + loose[0].length, loose.index + loose[0].length + 14)))) {
    return { value: Number(loose[1]) + Number(loose[2]) / 100, start: loose.index, end: loose.index + loose[0].length, marked: false };
  }

  // 4) "mil e quinhentos" sem moeda
  let best: Hit | null = null;
  for (let i = 0; i < words.length; i++) {
    if (!isNumWord(words[i].norm)) continue;
    let k = i;
    const run: string[] = [];
    while (k < words.length && (isNumWord(words[k].norm) || (words[k].norm === "e" && k + 1 < words.length && isNumWord(words[k + 1].norm)))) run.push(words[k++].norm);
    const v = wordsToNumber(run);
    if (v !== null && v >= 20 && (!best || v > best.value)) best = { value: v, start: words[i].start, end: words[k - 1].end, marked: false };
    i = k;
  }
  return best;
}

// ------------------------------------------------------------------ data
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

type DateHit = { date: string; start: number; end: number };

function findDate(original: string, today: string): DateHit | null {
  const [ty, tm, td] = today.split("-").map(Number);
  const n = strip(original);
  const at = (re: RegExp) => {
    const m = re.exec(n);
    return m ? { m, start: m.index, end: m.index + m[0].length } : null;
  };

  let h = at(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
  if (h) {
    const d = +h.m[1], mo = +h.m[2];
    const y = h.m[3].length === 2 ? 2000 + +h.m[3] : +h.m[3];
    if (validDay(y, mo, d)) return { date: iso(y, mo, d), start: h.start, end: h.end };
    return null; // escreveu uma data completa, mas ela não existe (ex.: 31/02): não adivinha outra
  }
  h = at(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (h) {
    const mo = MONTHS.indexOf(h.m[2]) + 1;
    const d = +h.m[1];
    if (mo > 0) {
      const y = h.m[3] ? +h.m[3] : mo > tm || (mo === tm && d > td) ? ty - 1 : ty;
      if (validDay(y, mo, d)) return { date: iso(y, mo, d), start: h.start, end: h.end };
    }
  }
  h = at(/\b(\d{1,2})[/.-](\d{1,2})\b/);
  if (h) {
    const d = +h.m[1], mo = +h.m[2];
    const y = mo > tm || (mo === tm && d > td) ? ty - 1 : ty;
    if (validDay(y, mo, d)) return { date: iso(y, mo, d), start: h.start, end: h.end };
    return null;
  }
  h = at(/\bdia\s+(\d{1,2})\b/);
  if (h) {
    const d = +h.m[1];
    let y = ty, mo = tm;
    if (d > td) { mo -= 1; if (mo === 0) { mo = 12; y -= 1; } } // "dia 28" dito no dia 3 = mês passado
    if (validDay(y, mo, d)) return { date: iso(y, mo, d), start: h.start, end: h.end };
  }
  h = at(/\banteontem\b/);
  if (h) return { date: addDays(today, -2), start: h.start, end: h.end };
  h = at(/\bontem\b/);
  if (h) return { date: addDays(today, -1), start: h.start, end: h.end };
  h = at(/\bhoje\b/);
  if (h) return { date: today, start: h.start, end: h.end };
  return null;
}

// ------------------------------------------------------------------ tipo, situação, categoria
const has = (n: string, words: string[]) => words.reduce((c, w) => c + (new RegExp(`\\b${w}`).test(n) ? 1 : 0), 0);

const ENTRADA = ["recebi", "recebemos", "recebimento", "recebido", "entrou", "entrada", "cliente pagou", "pagou a gente", "depositou", "deposito", "faturei", "faturamento", "vendi", "venda", "pix recebido", "caiu na conta"];
const SAIDA = ["paguei", "pagamos", "gastei", "gastamos", "gasto", "comprei", "compramos", "compra", "abasteci", "abastecimento", "despesa", "nota fiscal", "cupom", "boleto", "conta de", "saiu", "saida", "paguei", "debito", "desconto"];
const PENDENTE_SAIDA = ["a pagar", "vence", "vencimento", "vai vencer", "nao paguei", "ainda nao paguei", "fiado", "a prazo", "pagar dia", "pagar ate", "pra pagar"];
const PENDENTE_ENTRADA = ["a receber", "vai receber", "vai pagar", "ainda nao recebi", "nao recebi", "combinou", "previsao", "receber dia", "vamos receber"];

// A ordem importa: a primeira categoria cujo vocabulário aparecer ganha.
const CATEGORIAS_SAIDA: [string, string[]][] = [
  ["Combustível / abastecimento", ["posto", "diesel", "gasolina", "etanol", "alcool", "combustivel", "abasteci", "abastecimento", "gnv", "oleo diesel"]],
  ["Hospedagem", ["hotel", "pousada", "hospedagem", "hostel", "diaria do hotel"]],
  ["Ajudante (diária)", ["ajudante", "diarista", "peao", "diaria", "auxiliar de campo"]],
  ["Peças e baterias", ["bateria", "peca", "helice", "carregador", "motor", "bico", "sensor", "gerador"]],
  ["Manutenção", ["manutencao", "conserto", "oficina", "reparo", "mecanico", "revisao", "pneu", "troca de oleo"]],
  ["Aluguel de veículo", ["aluguel do carro", "aluguel de carro", "aluguel de veiculo", "locacao", "locadora", "aluguel da caminhonete", "aluguel"]],
  ["Seguro", ["seguro", "apolice"]],
  ["Pedágio / transporte", ["pedagio", "balsa", "frete", "passagem", "uber", "taxi", "onibus", "transporte", "estacionamento"]],
  ["Impostos (DAS MEI)", ["das", "imposto", "mei", "simples nacional", "taxa", "tributo", "inss"]],
  ["Marketing", ["anuncio", "instagram", "panfleto", "trafego", "marketing", "propaganda", "adesivo", "camisa"]],
  ["Alimentação", ["almoco", "janta", "jantar", "cafe da manha", "lanche", "restaurante", "marmita", "comida", "mercado", "supermercado", "padaria", "agua", "refeicao", "pizza"]],
];
const CATEGORIAS_ENTRADA: [string, string[]][] = [
  ["Serviço de aplicação", ["aplicacao", "pulverizacao", "pulverizar", "hectare", "hectares", "servico", "fazenda", "cliente", "lavoura", "safra", "soja", "milho", "adubo", "defensivo"]],
];

function guessCategory(n: string, tipo: "saida" | "entrada" | null): string | null {
  const tables = tipo === "entrada" ? [CATEGORIAS_ENTRADA] : tipo === "saida" ? [CATEGORIAS_SAIDA] : [CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA];
  for (const table of tables) {
    for (const [cat, words] of table) if (has(n, words)) return cat;
  }
  return null;
}

// ------------------------------------------------------------------ descrição
function cleanDescription(original: string, cut: [number, number][]): string | null {
  let s = original;
  // remove de trás para frente para não deslocar os índices
  for (const [a, b] of [...cut].sort((x, y) => y[0] - x[0])) s = s.slice(0, a) + " " + s.slice(b);
  s = s
    .replace(/^\s*(?:e\s+)?(?:eu\s+)?(?:acabei de\s+)?(?:nota fiscal|nf|cupom|recibo|comprovante)\s+(?:de|da|do)?\s*/i, "")
    .replace(/^\s*(?:eu\s+)?(?:paguei|pagamos|gastei|gastamos|comprei|compramos|recebi|recebemos|abasteci)\s+(?:de|da|do|com|em|um|uma)?\s*/i, "")
    .replace(/\b(?:hoje|ontem|anteontem)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[\s,.;:\-–—]+|[\s,.;:\-–—]+$/g, "")
    .replace(/^(?:de|da|do|dos|das|em|no|na|com)\s+(?=\S{3,})/i, "");
  if (s.length < 3) return null;
  return (s[0].toUpperCase() + s.slice(1)).slice(0, 200);
}

// ------------------------------------------------------------------ API
export function parseSpokenEntry(text: string, today: string): SpokenEntry {
  const original = text.replace(/\s+/g, " ").trim();
  const empty: SpokenEntry = { tipo: null, amount: null, date: null, status: null, category: null, description: null };
  if (!original) return empty;
  const n = strip(original);

  const amount = findAmount(original);
  const date = findDate(original, today);

  const ent = has(n, ENTRADA);
  const sai = has(n, SAIDA);
  const tipo: SpokenEntry["tipo"] = ent > sai ? "entrada" : sai > ent ? "saida" : ent > 0 ? "entrada" : null;

  let status: SpokenEntry["status"] = null;
  if (tipo === "entrada") status = has(n, PENDENTE_ENTRADA) ? "pendente" : "pago";
  else if (tipo === "saida") status = has(n, PENDENTE_SAIDA) ? "pendente" : "pago";
  else if (has(n, [...PENDENTE_SAIDA, ...PENDENTE_ENTRADA])) status = "pendente";

  const cut: [number, number][] = [];
  if (amount) cut.push([amount.start, amount.end]);
  if (date) {
    // leva junto o "dia"/"no dia"/"em" que antecede a data ("dia 28/10", "em 15 de outubro")
    const lead = /(?:\b(?:no|na|em|do|de)\s+)?\bdia\s*$|\b(?:em|no|na)\s*$/i.exec(original.slice(0, date.start));
    cut.push([lead ? lead.index : date.start, date.end]);
  }

  return {
    tipo,
    amount: amount?.value ?? null,
    date: date?.date ?? null,
    status,
    category: guessCategory(n, tipo),
    description: cleanDescription(original, cut),
  };
}

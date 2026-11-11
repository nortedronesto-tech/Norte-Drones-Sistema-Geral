// Reconhece, no que a pessoa falou ou digitou, QUAL CONTA e QUAL FORNECEDOR ela quis dizer — PURO e testável.
//   "paguei 150 de diesel pelo Nubank"           → conta "Nubank MEI"
//   "gastei 80 no almoço, conta do Mateus"         → conta "Conta MEI Mateus"
// Só escolhe quando há UMA melhor opção. Em dúvida (empate ou nada parecido) devolve item = null e a tela pede
// para a pessoa escolher: lançar na conta errada é pior que perguntar.

export type Named = { id: string; name: string; kind?: string };
export type NameMatch<T> = { item: T | null; candidates: T[]; words: string[] };

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palavras que não identificam ninguém (peso 0) e palavras que identificam pouco (peso 0,4).
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "conta", "contas", "bancaria", "banco", "bank", "ltda", "me", "s", "sa", "cia"]);
const WEAK = new Set(["mei", "empresa", "caixa", "drones", "drone", "porto", "norte", "posto", "mercado", "loja", "auto", "pecas", "distribuidora", "comercio"]);

// O que a pessoa costuma dizer para cada tipo de conta.
const KIND_ALIASES: Record<string, string[]> = { caixa: ["dinheiro", "especie", "caixa", "carteira"], mei: ["mei"], empresa: ["empresa"] };

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** A palavra do item aparece na fala? Aceita erro de reconhecimento de voz ("Matheus"/"Mateus", "Nu bank"/"Nubank"). */
function findToken(token: string, words: string[], compact: string): { hit: boolean; word?: string } {
  const exact = words.find((w) => w === token);
  if (exact) return { hit: true, word: exact };
  if (token.length >= 5) {
    const max = token.length >= 8 ? 2 : 1;
    const near = words.find((w) => w.length >= 4 && lev(w, token, max) <= max);
    if (near) return { hit: true, word: near };
    if (compact.includes(token)) return { hit: true }; // "nu bank" falado → "nubank"
  }
  return { hit: false };
}

export function matchByName<T extends Named>(text: string, items: T[], opts: { minRatio?: number } = {}): NameMatch<T> {
  const norm = strip(text);
  const words = norm.match(/[a-z0-9]+/g) ?? [];
  const compact = norm.replace(/[^a-z0-9]/g, "");
  const minRatio = opts.minRatio ?? 0.5;
  const scored = items.map((item) => {
    const tokens = new Set<string>();
    for (const t of strip(item.name).match(/[a-z0-9]+/g) ?? []) if (!STOP.has(t)) tokens.add(t);
    for (const t of KIND_ALIASES[item.kind ?? ""] ?? []) tokens.add(t);
    let total = 0, got = 0;
    const used: string[] = [];
    for (const t of tokens) {
      const w = WEAK.has(t) ? 0.4 : 1;
      total += w;
      const f = findToken(t, words, compact);
      if (f.hit) { got += w; if (f.word) used.push(f.word); }
    }
    return { item, score: got, ratio: total ? got / total : 0, used };
  }).filter((s) => s.score > 0);
  if (!scored.length) return { item: null, candidates: [], words: [] };
  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => Math.abs(s.score - best) < 1e-9);
  // Um único vencedor só vale se acertou um nome "forte" (peso cheio) ou boa parte do nome; só "MEI"/"posto" não decide.
  if (top.length === 1) {
    const t = top[0];
    if (t.score >= 1 || t.ratio >= minRatio) return { item: t.item, candidates: [t.item], words: t.used };
    return { item: null, candidates: [t.item], words: [] };
  }
  return { item: null, candidates: top.map((s) => s.item), words: [] };
}

/** Tira da descrição o trecho que só indicava a conta/fornecedor ("pelo Nubank", "na conta do Mateus"). */
export function removeNamed(description: string | null, words: string[]): string | null {
  if (!description || !words.length) return description;
  let out = description;
  for (const w of new Set(words)) {
    const n = strip(out);
    if (n.length !== out.length) return description; // acentos decompostos: não arrisca cortar errado
    const re = new RegExp(`(?:\\b(?:pel[oa]s?|n[oa]s?|d[oa]s?|de|com|via|em)\\s+)?(?:(?:a\\s+)?conta\\s+(?:d[oa]s?\\s+|de\\s+)?)?\\b${w}\\b`, "i");
    const m = re.exec(n);
    if (m) out = (out.slice(0, m.index) + " " + out.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  }
  out = out.replace(/^[\s,.;:\-–—]+|[\s,.;:\-–—]+$/g, "");
  return out.length >= 3 ? out[0].toUpperCase() + out.slice(1) : null;
}

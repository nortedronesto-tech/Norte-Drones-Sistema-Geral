// Compra/venda parcelada: gera uma conta a pagar (ou a receber) por mês. PURO, testado em tests/parcelas.test.ts.

export const MAX_PARCELAS = 60;

export type Parcela = { n: number; of: number; amount: number; date: string; description: string };

/** Soma meses mantendo o dia do 1º vencimento; se o mês não tem o dia (31), usa o último dia do mês. */
export function addMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + meses;
  const ano = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/**
 * `valor` é o total (dividido em centavos exatos; a diferença vai na última parcela)
 * ou o valor de cada parcela, conforme `modo`.
 */
export function gerarParcelas(o: { valor: number; modo: "total" | "parcela"; n: number; primeiro: string; descricao: string }): Parcela[] {
  const n = Math.trunc(o.n);
  if (!(o.valor > 0) || n < 1 || n > MAX_PARCELAS || !/^\d{4}-\d{2}-\d{2}$/.test(o.primeiro)) return [];
  const centavos = Math.round(o.valor * 100);
  const base = o.modo === "parcela" ? centavos : Math.floor(centavos / n);
  const resto = o.modo === "parcela" ? 0 : centavos - base * n;
  const texto = o.descricao.trim();
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    of: n,
    amount: (base + (i === n - 1 ? resto : 0)) / 100,
    date: addMeses(o.primeiro, i),
    description: n === 1 ? texto : `${texto ? `${texto} ` : ""}(${i + 1}/${n})`,
  }));
}

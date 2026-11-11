// Conferências do lançamento antes de salvar — PURAS, testadas em tests/lancamento-check.test.ts.

export const VALOR_ALTO = 50_000;

export type EntradaCheck = { amount: number | null; paid: boolean; date: string; today: string };

/** Erro que impede salvar (mensagem pronta para a tela), ou null se está tudo certo. */
export function validarLancamento({ amount, paid, date, today }: EntradaCheck): string | null {
  if (!amount || amount <= 0) return "Informe um valor maior que zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Informe a data.";
  if (paid && date > today) return "Lançamento já pago/recebido não pode ter data no futuro. Marque como “A pagar/A receber” ou corrija a data.";
  return null;
}

/** Avisos que pedem uma segunda olhada, mas deixam salvar. */
export function avisosLancamento({ amount, paid, date, today }: EntradaCheck): string[] {
  const out: string[] = [];
  if (amount && amount >= VALOR_ALTO) out.push("Valor muito alto. Confira se não digitou zeros a mais.");
  const [y, m, d] = today.split("-").map(Number);
  const limite = new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10);
  if (date < limite) out.push("A data é de mais de 1 ano atrás.");
  if (!paid && date < today) out.push("O vencimento já passou: este lançamento entra como atrasado.");
  return out;
}

export type Parecido = { amount: number; date: string; type: string; account_id: string };

/** Mesmo tipo, conta e valor (ao centavo), com até `dias` de diferença: provável lançamento repetido. */
export function parecidos(novo: Parecido, existentes: Parecido[], dias = 3): Parecido[] {
  const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return existentes.filter((e) =>
    e.type === novo.type && e.account_id === novo.account_id &&
    Math.round(e.amount * 100) === Math.round(novo.amount * 100) &&
    Math.abs(t(e.date) - t(novo.date)) <= dias * 86_400_000);
}

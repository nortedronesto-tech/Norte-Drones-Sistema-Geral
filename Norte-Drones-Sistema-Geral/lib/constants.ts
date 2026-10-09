import type { TxStatus, TxType, AccountKind } from "./types";

// Categorias vivem no código (texto livre no banco) para ficar fácil ajustar.
// Derivadas do que o negócio já tem: aluguel de carro fixo, ajudante diário,
// diesel/gasolina do gerador, bateria do drone, seguro, DAS dos MEIs etc.
export const EXPENSE_CATEGORIES = [
  "Combustível / abastecimento",
  "Ajudante (diária)",
  "Manutenção",
  "Peças e baterias",
  "Aluguel de veículo",
  "Seguro",
  "Alimentação",
  "Hospedagem",
  "Pedágio / transporte",
  "Impostos (DAS MEI)",
  "Marketing",
  "Outros",
] as const;

export const INCOME_CATEGORIES = [
  "Serviço de aplicação",
  "Outras receitas",
] as const;

export const categoriesFor = (type: TxType): readonly string[] =>
  type === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

export function statusLabel(status: TxStatus, type: TxType): string {
  if (status === "pago") return type === "entrada" ? "Recebido" : "Pago";
  return status === "a_pagar" ? "A pagar" : "A receber";
}

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  mei: "Conta MEI",
  empresa: "Conta da empresa",
  caixa: "Caixa / dinheiro",
};

export const TIMEZONE = "America/Araguaina";

export type TxType = "entrada" | "saida";
export type TxStatus = "pago" | "a_pagar" | "a_receber";
export type AccountKind = "mei" | "empresa" | "caixa";

export interface Partner {
  id: string;
  name: string;
  email: string | null;
  share_pct: number;
  active: boolean;
  created_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  kind: AccountKind;
  partner_id: string | null;
  initial_balance: number;
  active: boolean;
}

export interface AccountBalance extends BankAccount {
  balance: number;
  to_receive: number;
  to_pay: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  account_id: string;
  category: string;
  description: string | null;
  status: TxStatus;
  date: string; // YYYY-MM-DD
  paid_at: string | null;
  receipt_path: string | null;
  created_at: string;
  bank_accounts?: { name: string } | null;
}

export interface ReserveEntry {
  id: string;
  entry_date: string;
  kind: "retencao" | "retirada" | "ajuste";
  amount: number;
  partner_id: string | null;
  transaction_id: string | null;
  description: string | null;
  created_at: string;
  partners?: { name: string } | null;
}

export interface PartnerTotals {
  id: string;
  name: string;
  share_pct: number;
  split_total: number;
  reserve_total: number;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

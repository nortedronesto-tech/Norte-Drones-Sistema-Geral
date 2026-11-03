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

export interface Supplier {
  id: string;
  name: string;
  doc: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  doc: string | null;
  phone: string | null;
  city: string | null;
  price_per_ha: number | null;
  notes: string | null;
  active: boolean;
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
  supplier_id?: string | null;
  reconciled_at?: string | null;
  bank_accounts?: { name: string } | null;
  suppliers?: { name: string } | null;
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

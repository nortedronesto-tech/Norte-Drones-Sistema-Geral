// Texto da trilha de auditoria em português — PURO, testado em tests/audit.test.ts.

export type AuditRow = {
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  subject: string | null;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changes: Record<string, { de: unknown; para: unknown }> | null;
};

export const TABLE_LABEL: Record<string, string> = {
  transactions: "Lançamento", bank_accounts: "Conta", partners: "Sócio", settings: "Configuração", reserve_fund_entries: "Reserva",
  user_access: "Acesso de usuário", suppliers: "Fornecedor", clients: "Cliente", service_orders: "OS", recurring_transactions: "Recorrente", spray_recipes: "Receita de calda",
};

const FIELD_LABEL: Record<string, string> = {
  amount: "valor", status: "situação", date: "data", paid_at: "pago em", category: "categoria", description: "descrição", type: "tipo",
  account_id: "conta", supplier_id: "fornecedor", name: "nome", price_per_ha: "valor por ha", area_ha: "área (ha)", role: "nível", active: "ativo",
  share_pct: "participação (%)", email: "e-mail", phone: "telefone", doc: "CNPJ/CPF", farm: "fazenda", service_date: "data do serviço",
  client_id: "cliente", client_ok_at: "OK do cliente", day_of_month: "dia do mês", next_due: "próximo vencimento", end_date: "termina em",
  value: "valor", initial_balance: "saldo inicial", kind: "tipo", notes: "observação", city: "cidade", crop: "cultura", target: "alvo",
  drone: "drone", operator_name: "operador", receipt_path: "foto do recibo", reconciled_at: "conciliado em", rate_l_ha: "calda (L/ha)", tank_l: "tanque (L)",
};
const STATUS_LABEL: Record<string, string> = { pago: "pago/recebido", a_pagar: "a pagar", a_receber: "a receber", aberta: "aberta", concluida: "concluída", cancelada: "cancelada" };
const MONEY = new Set(["amount", "price_per_ha", "initial_balance"]);
// campos técnicos que não interessam a quem lê a trilha
const HIDDEN = new Set(["id", "created_at", "created_by", "reconciled_by", "closed_at", "transaction_id", "recurring_id", "recurring_due", "total_amount", "number", "products", "preflight"]);

const VERB: Record<AuditRow["action"], string> = { INSERT: "Criou", UPDATE: "Alterou", DELETE: "Apagou" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (MONEY.has(field) && !Number.isNaN(Number(v))) return brl(Number(v));
  if (field === "status" && typeof v === "string") return STATUS_LABEL[v] ?? v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  if (typeof v === "object") return "(dados)";
  return String(v);
}

/** Quebra de uma linha da trilha em título e frases curtas. */
export function describeAudit(r: AuditRow): { title: string; lines: string[] } {
  const label = TABLE_LABEL[r.table_name] ?? r.table_name;
  const subject = r.subject ? `: ${r.subject}` : "";
  const title = `${VERB[r.action]} ${label.toLowerCase()}${subject}`;
  const lines: string[] = [];
  if (r.action === "UPDATE" && r.changes) {
    for (const [field, c] of Object.entries(r.changes)) {
      if (HIDDEN.has(field)) continue;
      const name = FIELD_LABEL[field] ?? field;
      if (field.endsWith("_id") && field !== "id") lines.push(`${name} alterado(a)`);
      else lines.push(`${name}: ${formatValue(field, c.de)} → ${formatValue(field, c.para)}`);
    }
  } else {
    const row = r.new_row ?? r.old_row ?? {};
    if (row.amount !== undefined) lines.push(`valor: ${formatValue("amount", row.amount)}`);
    if (row.status) lines.push(`situação: ${formatValue("status", row.status)}`);
    if (row.type && r.table_name === "transactions") lines.push(row.type === "entrada" ? "entrada" : "saída");
    if (row.category && r.table_name === "transactions") lines.push(`categoria: ${String(row.category)}`);
    if (row.date && r.table_name === "transactions") lines.push(`data: ${formatValue("date", row.date)}`);
    if (row.role) lines.push(`nível: ${String(row.role)}`);
  }
  return { title, lines };
}

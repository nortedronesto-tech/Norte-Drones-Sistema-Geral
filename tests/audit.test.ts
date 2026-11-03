import test from "node:test";
import assert from "node:assert/strict";
import { describeAudit, formatValue, type AuditRow } from "../lib/audit.ts";

const base: AuditRow = { action: "UPDATE", table_name: "transactions", subject: "Diesel L200", old_row: null, new_row: null, changes: null };

test("edição de valor mostra de → para em reais", () => {
  const d = describeAudit({ ...base, changes: { amount: { de: "80.00", para: "95.50" }, updated_noise: { de: 1, para: 2 } } });
  assert.equal(d.title, "Alterou lançamento: Diesel L200");
  assert.match(d.lines[0], /^valor: R\$\s?80,00 → R\$\s?95,50$/);
});

test("situação, data e conta ficam em português; campos técnicos somem", () => {
  const d = describeAudit({ ...base, changes: {
    status: { de: "a_pagar", para: "pago" }, date: { de: "2026-11-01", para: "2026-11-05" }, account_id: { de: "x", para: "y" },
    created_at: { de: "a", para: "b" }, reconciled_by: { de: null, para: "z" },
  } });
  assert.deepEqual(d.lines, ["situação: a pagar → pago/recebido", "data: 01/11/2026 → 05/11/2026", "conta alterado(a)"]);
});

test("criar e apagar resumem o lançamento", () => {
  const novo = describeAudit({ ...base, action: "INSERT", new_row: { amount: 150, status: "pago", type: "saida", category: "Combustível", date: "2026-11-02" } });
  assert.equal(novo.title, "Criou lançamento: Diesel L200");
  assert.deepEqual(novo.lines, ["valor: " + formatValue("amount", 150), "situação: pago/recebido", "saída", "categoria: Combustível", "data: 02/11/2026"]);
  const apagado = describeAudit({ ...base, action: "DELETE", subject: null, old_row: { amount: 10, status: "a_pagar" } });
  assert.equal(apagado.title, "Apagou lançamento");
});

test("nomes de tabela e valores vazios/booleanos", () => {
  assert.equal(describeAudit({ ...base, table_name: "user_access", action: "INSERT", subject: "ana@x.com", new_row: { role: "operador" } }).title, "Criou acesso de usuário: ana@x.com");
  assert.equal(formatValue("active", true), "sim");
  assert.equal(formatValue("notes", null), "—");
  assert.equal(formatValue("price_per_ha", 95), formatValue("amount", 95));
});

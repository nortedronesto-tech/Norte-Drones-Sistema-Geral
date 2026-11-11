import test from "node:test";
import assert from "node:assert/strict";
import { validarLancamento, avisosLancamento, parecidos } from "../lib/lancamento-check.ts";

const T = "2026-11-11";

test("valor vazio, zero ou data inválida bloqueiam", () => {
  assert.match(validarLancamento({ amount: null, paid: true, date: T, today: T })!, /valor/i);
  assert.match(validarLancamento({ amount: 0, paid: true, date: T, today: T })!, /valor/i);
  assert.match(validarLancamento({ amount: 10, paid: true, date: "", today: T })!, /data/i);
});

test("pago com data futura bloqueia; pendente com data futura é normal", () => {
  assert.match(validarLancamento({ amount: 10, paid: true, date: "2026-11-12", today: T })!, /futuro/);
  assert.equal(validarLancamento({ amount: 10, paid: false, date: "2026-12-01", today: T }), null);
  assert.equal(validarLancamento({ amount: 10, paid: true, date: T, today: T }), null);
});

test("avisos: valor alto, data antiga e vencimento atrasado", () => {
  assert.equal(avisosLancamento({ amount: 100, paid: true, date: T, today: T }).length, 0);
  assert.equal(avisosLancamento({ amount: 50000, paid: true, date: T, today: T }).length, 1);
  assert.equal(avisosLancamento({ amount: 100, paid: true, date: "2025-11-10", today: T }).length, 1);
  assert.equal(avisosLancamento({ amount: 100, paid: true, date: "2025-11-11", today: T }).length, 0);
  assert.match(avisosLancamento({ amount: 100, paid: false, date: "2026-11-01", today: T })[0], /atrasado/);
});

test("parecidos: mesmo tipo, conta, valor e até 3 dias de diferença", () => {
  const novo = { amount: 150.5, date: "2026-11-11", type: "saida", account_id: "a" };
  const base = { ...novo };
  assert.equal(parecidos(novo, [base]).length, 1);
  assert.equal(parecidos(novo, [{ ...base, date: "2026-11-08" }]).length, 1);
  assert.equal(parecidos(novo, [{ ...base, date: "2026-11-07" }]).length, 0);
  assert.equal(parecidos(novo, [{ ...base, amount: 150.51 }]).length, 0);
  assert.equal(parecidos(novo, [{ ...base, account_id: "b" }]).length, 0);
  assert.equal(parecidos(novo, [{ ...base, type: "entrada" }]).length, 0);
});

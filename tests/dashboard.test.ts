import test from "node:test";
import assert from "node:assert/strict";
import { categoryTotals, csvLine, dueBuckets, monthlySeries, monthReport, shiftMonth, type Tx } from "../lib/dashboard.ts";
import { calcSolidos, solidosText } from "../lib/calda.ts";

const tx = (o: Partial<Tx>): Tx => ({ type: "saida", amount: 10, status: "pago", date: "2026-11-01", paid_at: "2026-11-01", category: "Outros", ...o });

test("shiftMonth atravessa o ano", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-11", 2), "2027-01");
});

test("série mensal: 6 meses em ordem, só pagos, centavos exatos", () => {
  const s = monthlySeries([
    tx({ type: "entrada", amount: 0.1, paid_at: "2026-11-02" }),
    tx({ type: "entrada", amount: 0.2, paid_at: "2026-11-03" }),
    tx({ type: "saida", amount: 5, paid_at: "2026-10-10" }),
    tx({ type: "saida", amount: 99, status: "a_pagar", paid_at: null }),
    tx({ type: "saida", amount: 7, paid_at: "2025-01-01" }),
  ], "2026-11", 6);
  assert.deepEqual(s.map((x) => x.month), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  assert.equal(s[5].entradas, 0.3);
  assert.equal(s[4].saidas, 5);
  assert.equal(s[5].saidas, 0);
});

test("categorias: ordem, percentual e ignora pendentes/outro tipo", () => {
  const c = categoryTotals([
    tx({ category: "A", amount: 30 }), tx({ category: "B", amount: 70 }),
    tx({ category: "C", amount: 5, status: "a_pagar", paid_at: null }),
    tx({ category: "D", amount: 9, type: "entrada" }),
  ], "saida");
  assert.deepEqual(c.map((x) => x.category), ["B", "A"]);
  assert.deepEqual(c.map((x) => x.pct), [70, 30]);
});

test("vencimentos: atrasado, 7 dias e depois", () => {
  const rows = [
    tx({ status: "a_pagar", paid_at: null, date: "2026-10-30", amount: 100 }),
    tx({ status: "a_pagar", paid_at: null, date: "2026-11-02", amount: 50 }),
    tx({ status: "a_pagar", paid_at: null, date: "2026-11-09", amount: 25 }),
    tx({ status: "a_pagar", paid_at: null, date: "2026-11-10", amount: 10 }),
    tx({ type: "entrada", status: "a_receber", paid_at: null, date: "2026-11-05", amount: 999 }),
  ];
  const b = dueBuckets(rows, "a_pagar", "2026-11-02");
  assert.deepEqual(b.overdue, { count: 1, amount: 100 });
  assert.deepEqual(b.week, { count: 2, amount: 75 });
  assert.deepEqual(b.later, { count: 1, amount: 10 });
});

test("relatório do mês: resultado, margem e pendências do mês", () => {
  const r = monthReport([
    tx({ type: "entrada", amount: 1000, category: "Serviço de aplicação", paid_at: "2026-11-05" }),
    tx({ amount: 250, category: "Combustível", paid_at: "2026-11-06" }),
    tx({ amount: 40, status: "a_pagar", paid_at: null, date: "2026-11-20" }),
    tx({ type: "entrada", amount: 300, status: "a_receber", paid_at: null, date: "2026-11-25" }),
    tx({ amount: 500, paid_at: "2026-10-06" }),
  ], "2026-11");
  assert.equal(r.entradas, 1000); assert.equal(r.saidas, 250); assert.equal(r.resultado, 750);
  assert.equal(r.margem, 75); assert.equal(r.aPagar, 40); assert.equal(r.aReceber, 300);
  assert.equal(monthReport([], "2026-11").margem, null);
});

test("CSV: vírgula decimal e aspas", () => {
  assert.equal(csvLine(["a;b", 12.5, 'x"y']), '"a;b";12,50;"x""y"');
});

test("sólidos: cargas, carga parcial e sacos", () => {
  const r = calcSolidos({ areaHa: 10, doseKgHa: 50, hopperKg: 40, bagKg: 25 });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.totalKg, 500); assert.equal(r.loadCount, 13); assert.equal(r.haPerLoad, 0.8);
    assert.equal(r.loads[12].kg, 20); assert.equal(r.loads[12].full, false);
    assert.equal(r.bags, 20);
    assert.match(solidosText("Teste", { areaHa: 10, doseKgHa: 50, hopperKg: 40 }, r), /13 carga/);
  }
});

test("sólidos: entradas inválidas e limite", () => {
  assert.equal(calcSolidos({ areaHa: 0, doseKgHa: 50, hopperKg: 40 }).ok, false);
  assert.equal(calcSolidos({ areaHa: 10, doseKgHa: 0, hopperKg: 40 }).ok, false);
  assert.equal(calcSolidos({ areaHa: 10, doseKgHa: 50, hopperKg: 0 }).ok, false);
  assert.equal(calcSolidos({ areaHa: 1000, doseKgHa: 100, hopperKg: 10 }).ok, false);
});

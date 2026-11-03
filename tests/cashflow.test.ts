import test from "node:test";
import assert from "node:assert/strict";
import { projectCashflow, type PendingRow, type RecurringRule } from "../lib/cashflow.ts";

const TODAY = "2026-11-03";
const out = (date: string, amount: number): PendingRow => ({ type: "saida", amount, date, status: "a_pagar" });
const inn = (date: string, amount: number): PendingRow => ({ type: "entrada", amount, date, status: "a_receber" });

test("soma pendências dia a dia e acha o menor saldo", () => {
  const r = projectCashflow(1000, [out("2026-11-10", 1500), inn("2026-11-20", 3000)], [], TODAY);
  assert.equal(r.start, 1000);
  assert.equal(r.end, 2500);
  assert.deepEqual(r.lowest, { date: "2026-11-10", balance: -500 });
  assert.equal(r.goesNegative, true);
  assert.equal(r.firstNegative, "2026-11-10");
  assert.equal(r.totalIn, 3000);
  assert.equal(r.totalOut, 1500);
});

test("atrasadas entram hoje; o que passa do horizonte e o que já foi pago ficam de fora", () => {
  const r = projectCashflow(500, [out("2026-10-20", 200), out("2027-03-01", 999), { ...out("2026-11-05", 300), status: "pago" }], [], TODAY, 60);
  assert.equal(r.points[0].date, TODAY);
  assert.equal(r.points[0].balance, 300); // 500 − 200 atrasada
  assert.equal(r.end, 300);
  assert.equal(r.goesNegative, false);
});

test("centavos exatos (0,1 + 0,2)", () => {
  const r = projectCashflow(0, [inn("2026-11-04", 0.1), inn("2026-11-05", 0.2)], [], TODAY);
  assert.equal(r.end, 0.3);
});

test("recorrentes futuras entram; as da janela já gerada não contam em dobro", () => {
  const rule: RecurringRule = { type: "saida", amount: 100, day_of_month: 5, next_due: "2026-11-05", end_date: null, active: true };
  // 05/11 está dentro dos 7 dias já gerados (e viria em `pending`); só 05/12 e 05/01 são projetadas
  const r = projectCashflow(1000, [out("2026-11-05", 100)], [rule], TODAY, 90);
  assert.equal(r.end, 1000 - 100 - 100 - 100);
  assert.equal(r.totalOut, 300);
});

test("regra pausada ou terminada não projeta", () => {
  const base: RecurringRule = { type: "saida", amount: 100, day_of_month: 20, next_due: "2026-11-20", end_date: null, active: true };
  assert.equal(projectCashflow(1000, [], [{ ...base, active: false }], TODAY).end, 1000);
  assert.equal(projectCashflow(1000, [], [{ ...base, end_date: "2026-11-30" }], TODAY, 90).end, 900); // só 20/11
});

test("sem movimento: linha reta e nunca negativo", () => {
  const r = projectCashflow(250, [], [], TODAY, 30);
  assert.equal(r.points.length, 2);
  assert.equal(r.end, 250);
  assert.deepEqual(r.lowest, { date: TODAY, balance: 250 });
  assert.equal(r.firstNegative, null);
});

test("já começa negativo", () => {
  const r = projectCashflow(-50, [], [], TODAY);
  assert.equal(r.goesNegative, true);
  assert.equal(r.firstNegative, TODAY);
});

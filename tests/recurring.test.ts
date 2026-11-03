import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dayFromDate, dueDatesUpTo, dueOn, isFinished, nextMonthDue } from "../lib/recurring.ts";

test("dia 31 cai no último dia do mês curto e volta ao 31 depois", () => {
  assert.equal(dueOn(2026, 2, 31), "2026-02-28");
  assert.equal(dueOn(2028, 2, 31), "2028-02-29"); // ano bissexto
  assert.equal(dueOn(2026, 4, 31), "2026-04-30");
  assert.equal(nextMonthDue("2026-01-31", 31), "2026-02-28");
  assert.equal(nextMonthDue("2026-02-28", 31), "2026-03-31");
});

test("virada de ano e meses normais", () => {
  assert.equal(nextMonthDue("2026-12-10", 10), "2027-01-10");
  assert.equal(nextMonthDue("2026-11-05", 5), "2026-12-05");
  assert.equal(dayFromDate("2026-11-05"), 5);
});

test("soma de dias atravessa mês e ano", () => {
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
  assert.equal(addDays("2026-02-25", 7), "2026-03-04");
});

test("gera só o que vence até o horizonte (hoje + 7 dias)", () => {
  const r = dueDatesUpTo("2026-11-10", 10, "2026-11-09");
  assert.deepEqual(r, { dates: [], next: "2026-11-10" }); // ainda falta mais que 7 dias
  const r2 = dueDatesUpTo("2026-11-10", 10, "2026-11-10");
  assert.deepEqual(r2, { dates: ["2026-11-10"], next: "2026-12-10" });
});

test("recupera meses atrasados, no máximo 12 por vez", () => {
  const r = dueDatesUpTo("2026-01-05", 5, "2026-04-10");
  assert.deepEqual(r.dates, ["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05"]);
  assert.equal(r.next, "2026-05-05");
  const muitos = dueDatesUpTo("2020-01-01", 1, "2026-12-31");
  assert.equal(muitos.dates.length, 12);
});

test("respeita a data final e sabe quando a regra terminou", () => {
  const r = dueDatesUpTo("2026-11-01", 1, "2027-03-01", "2027-01-15");
  assert.deepEqual(r.dates, ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.equal(r.next, "2027-02-01");
  assert.equal(isFinished(r.next, "2027-01-15"), true);
  assert.equal(isFinished("2027-01-01", "2027-01-15"), false);
  assert.equal(isFinished("2027-01-01", null), false);
});

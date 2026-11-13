import test from "node:test";
import assert from "node:assert/strict";
import { addMeses, gerarParcelas } from "../lib/parcelas.ts";

test("soma meses e respeita fim de mês", () => {
  assert.equal(addMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(addMeses("2026-01-31", 2), "2026-03-31");
  assert.equal(addMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(addMeses("2026-11-10", 2), "2027-01-10");
  assert.equal(addMeses("2026-12-15", 12), "2027-12-15");
});

test("total dividido: soma fecha ao centavo e a sobra vai na última", () => {
  const p = gerarParcelas({ valor: 1000, modo: "total", n: 3, primeiro: "2026-12-10", descricao: "Drone" });
  assert.deepEqual(p.map((x) => x.amount), [333.33, 333.33, 333.34]);
  assert.equal(Math.round(p.reduce((s, x) => s + x.amount, 0) * 100), 100000);
  assert.deepEqual(p.map((x) => x.date), ["2026-12-10", "2027-01-10", "2027-02-10"]);
  assert.equal(p[1].description, "Drone (2/3)");
});

test("valor de cada parcela: multiplica", () => {
  const p = gerarParcelas({ valor: 150.5, modo: "parcela", n: 4, primeiro: "2026-12-10", descricao: "" });
  assert.deepEqual(p.map((x) => x.amount), [150.5, 150.5, 150.5, 150.5]);
  assert.equal(p[0].description, "(1/4)");
});

test("entradas inválidas não geram nada", () => {
  assert.equal(gerarParcelas({ valor: 0, modo: "total", n: 3, primeiro: "2026-12-10", descricao: "" }).length, 0);
  assert.equal(gerarParcelas({ valor: 10, modo: "total", n: 61, primeiro: "2026-12-10", descricao: "" }).length, 0);
  assert.equal(gerarParcelas({ valor: 10, modo: "total", n: 2, primeiro: "", descricao: "" }).length, 0);
});

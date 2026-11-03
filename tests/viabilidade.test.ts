import test from "node:test";
import assert from "node:assert/strict";
import { calcViabilidade, calcReal, sensibilidade, PREMISSAS_PADRAO, type Premissas } from "../lib/viabilidade.ts";

const base: Premissas = {
  precoHa: 100, haDia: 100, diasMes: 10, investimento: 120000, vidaAnos: 5, residualPct: 0,
  fixosMes: 3000, custoDia: 500, bateriaHa: 2, manutencaoHa: 3, geradorHa: 0, impostoPct: 0, margemAlvoPct: 30,
};

test("custo por ha soma dia de campo, desgaste e a parte dos fixos", () => {
  const r = calcViabilidade(base);
  assert.equal(r.haMes, 1000);
  assert.equal(r.depreciacaoMes, 2000); // 120000 / 60 meses
  assert.equal(r.fixosTotalMes, 5000);
  assert.equal(r.diaHa, 5); // 500 / 100 ha
  assert.equal(r.variavelHa, 10); // 5 + 2 + 3
  assert.equal(r.fixoHa, 5);
  assert.equal(r.custoHa, 15);
  assert.equal(r.lucroHa, 85);
  assert.equal(r.resultadoMes, 85000);
  assert.equal(r.margemPct, 85);
  assert.equal(r.nivel, "bom");
});

test("ponto de equilíbrio, preço mínimo e preço-alvo batem com a conta", () => {
  const r = calcViabilidade(base);
  assert.equal(r.equilibrioHa, 56); // 5000 / (100 − 10) = 55,6 → 56
  assert.equal(r.precoMinimo, 15);
  assert.equal(r.precoAlvo, 21.43); // 15 / 0,7
  // cobrando o preço mínimo, o resultado do mês é zero
  assert.equal(calcViabilidade({ ...base, precoHa: r.precoMinimo! }).resultadoMes, 0);
  // cobrando o preço-alvo, a margem é a desejada
  assert.ok(Math.abs(calcViabilidade({ ...base, precoHa: r.precoAlvo! }).margemPct! - 30) < 0.1);
});

test("imposto sobre a receita entra no custo e no preço mínimo", () => {
  const r = calcViabilidade({ ...base, impostoPct: 10 });
  assert.equal(r.impostoHa, 10);
  assert.equal(r.variavelHa, 20);
  const noMinimo = calcViabilidade({ ...base, impostoPct: 10, precoHa: r.precoMinimo! }).resultadoMes;
  assert.ok(noMinimo >= 0 && noMinimo < 10, String(noMinimo)); // arredondado para cima ao centavo
});

test("preço abaixo do custo variável: nunca fecha a conta", () => {
  const r = calcViabilidade({ ...base, precoHa: 8 });
  assert.equal(r.equilibrioHa, null);
  assert.equal(r.paybackMeses, null);
  assert.equal(r.nivel, "ruim");
  assert.ok(r.lucroHa < 0);
});

test("payback: meses para o resultado pagar o investimento", () => {
  assert.equal(calcViabilidade({ ...base, precoHa: 30 }).paybackMeses, Math.ceil(120000 / calcViabilidade({ ...base, precoHa: 30 }).resultadoMes));
});

test("valores vazios ou negativos não geram NaN", () => {
  const r = calcViabilidade({ ...PREMISSAS_PADRAO, haDia: 0, diasMes: -3, precoHa: NaN, vidaAnos: 0 });
  for (const v of Object.values(r)) if (typeof v === "number") assert.ok(Number.isFinite(v), String(v));
  assert.equal(r.margemPct, null);
  assert.equal(r.precoMinimo, null);
});

test("sensibilidade: o centro é o cenário-base e mais preço nunca piora", () => {
  const s = sensibilidade(base);
  assert.equal(s.linhas[2].celulas[2], calcViabilidade(base).resultadoMes);
  for (let c = 0; c < s.colunas.length; c++) for (let l = 1; l < s.linhas.length; l++) assert.ok(s.linhas[l].celulas[c] >= s.linhas[l - 1].celulas[c]);
});

test("realizado: custo e lucro por ha a partir das OS e das despesas pagas", () => {
  const r = calcReal({
    ha: 400, receitaOS: 40000, meses: 2,
    despesas: [{ category: "Combustível / abastecimento", amount: 6000 }, { category: "Ajudante (diária)", amount: 4000 }, { category: "Combustível / abastecimento", amount: 2000 }],
  });
  assert.equal(r.totalDespesas, 12000);
  assert.equal(r.custoHa, 30);
  assert.equal(r.precoMedio, 100);
  assert.equal(r.lucroHa, 70);
  assert.equal(r.resultado, 28000);
  assert.equal(r.margemPct, 70);
  assert.equal(r.haMes, 200);
  assert.deepEqual(r.porCategoria[0], { category: "Combustível / abastecimento", amount: 8000, porHa: 20, pct: 66.67 });
});

test("realizado sem hectares: não divide por zero", () => {
  const r = calcReal({ ha: 0, receitaOS: 0, meses: 3, despesas: [{ category: "Seguro", amount: 500 }] });
  assert.equal(r.custoHa, null);
  assert.equal(r.precoMedio, null);
  assert.equal(r.lucroHa, null);
  assert.equal(r.resultado, -500);
});

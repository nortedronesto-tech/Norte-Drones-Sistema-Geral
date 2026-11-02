import test from "node:test";
import assert from "node:assert/strict";
import { parseSpokenEntry, parseBRNumber, wordsToNumber } from "../lib/text-parse.ts";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/constants.ts";

const TODAY = "2026-11-02"; // segunda-feira
const p = (t: string) => parseSpokenEntry(t, TODAY);

test("números em formato brasileiro", () => {
  assert.equal(parseBRNumber("1.234,56"), 1234.56);
  assert.equal(parseBRNumber("1234,5"), 1234.5);
  assert.equal(parseBRNumber("1.234"), 1234);
  assert.equal(parseBRNumber("12.5"), 12.5);
  assert.equal(parseBRNumber("150"), 150);
  assert.equal(parseBRNumber("abc"), null);
});

test("números por extenso", () => {
  assert.equal(wordsToNumber(["cento", "e", "cinquenta"]), 150);
  assert.equal(wordsToNumber(["tres", "mil", "e", "quinhentos"]), 3500);
  assert.equal(wordsToNumber(["mil"]), 1000);
  assert.equal(wordsToNumber(["dois", "mil", "duzentos", "e", "trinta", "e", "cinco"]), 2235);
  assert.equal(wordsToNumber(["um", "milhao"]), 1_000_000);
  assert.equal(wordsToNumber(["posto"]), null);
});

test("valor: dígitos com 'reais', R$ e centavos", () => {
  assert.equal(p("Paguei 150 reais de diesel").amount, 150);
  assert.equal(p("gastei R$ 89,90 no mercado").amount, 89.9);
  assert.equal(p("deu 1.234,56 reais").amount, 1234.56);
  assert.equal(p("foram 3 mil e 500 reais").amount, 3500);
  assert.equal(p("recebi 2 mil").amount, 2000);
  assert.equal(p("200 contos de peça").amount, 200);
});

test("valor: por extenso", () => {
  assert.equal(p("paguei cento e cinquenta reais de diesel").amount, 150);
  assert.equal(p("recebi três mil e quinhentos reais").amount, 3500);
  assert.equal(p("gastei vinte reais e cinquenta centavos").amount, 20.5);
  assert.equal(p("foi mil reais").amount, 1000);
  assert.equal(p("nota de duzentos e trinta e cinco reais").amount, 235);
});

test("valor: ignora litros, hectares, km e datas", () => {
  assert.equal(p("abasteci 38 litros de diesel, 152,30").amount, 152.3);
  assert.equal(p("serviço de 40 hectares, recebi 3200 reais").amount, 3200);
  assert.equal(p("paguei 150 reais dia 15/10").amount, 150);
  assert.equal(p("rodei 320 km e gastei 410 reais").amount, 410);
});

test("valor: número solto sem moeda quando é o único", () => {
  assert.equal(p("diesel 180").amount, 180);
  assert.equal(p("mercado 89,90").amount, 89.9);
  assert.equal(p("pedágio e balsa, mil e duzentos").amount, 1200);
  assert.equal(p("só um posto de gasolina").amount, null);
});

test("valor: prefere o que vem depois de 'total'", () => {
  assert.equal(p("comprei 50 reais de gelo e 100 reais de comida, total 150 reais").amount, 150);
});

test("tipo: entrada x saída", () => {
  assert.equal(p("Recebi 3000 reais da Fazenda Boa Vista").tipo, "entrada");
  assert.equal(p("O cliente pagou 1500 reais").tipo, "entrada");
  assert.equal(p("Paguei 150 reais de diesel").tipo, "saida");
  assert.equal(p("Nota fiscal de 89,90 do mercado").tipo, "saida");
  assert.equal(p("Abasteci a caminhonete, 200 reais").tipo, "saida");
  assert.equal(p("150 reais").tipo, null);
});

test("situação: pago ou pendente", () => {
  assert.equal(p("Paguei 150 de diesel").status, "pago");
  assert.equal(p("Boleto de 300 reais a pagar dia 20").status, "pendente");
  assert.equal(p("Recebi 1000 reais do cliente").status, "pago");
  assert.equal(p("Vou receber 5000 reais, a receber dia 10").status, "pendente");
  assert.equal(p("O cliente ainda não pagou, a receber 2000 reais").status, "pendente");
});

test("categoria de saída", () => {
  assert.equal(p("paguei 150 de diesel no posto").category, "Combustível / abastecimento");
  assert.equal(p("diária do ajudante 120 reais").category, "Ajudante (diária)");
  assert.equal(p("comprei uma bateria nova por 900 reais").category, "Peças e baterias");
  assert.equal(p("almoço da equipe 85 reais").category, "Alimentação");
  assert.equal(p("hotel em Palmas 300 reais").category, "Hospedagem");
  assert.equal(p("pedágio e balsa 45 reais").category, "Pedágio / transporte");
  assert.equal(p("DAS do MEI 75 reais").category, "Impostos (DAS MEI)");
  assert.equal(p("conserto do drone na oficina, 400 reais").category, "Manutenção");
  assert.equal(p("seguro do drone 250 reais").category, "Seguro");
  assert.equal(p("paguei algo qualquer 20 reais").category, null);
});

test("categoria de entrada", () => {
  assert.equal(p("Recebi 3200 reais da Fazenda Boa Vista, 40 hectares").category, "Serviço de aplicação");
});

test("toda categoria devolvida existe na lista do sistema", () => {
  const all: readonly string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const frases = ["diesel", "ajudante", "bateria", "almoço", "hotel", "pedágio", "DAS", "oficina", "seguro", "anúncio instagram", "aluguel do carro", "fazenda aplicação"];
  for (const f of frases) {
    for (const verbo of ["paguei", "recebi"]) {
      const c = p(`${verbo} 100 reais ${f}`).category;
      if (c) assert.ok(all.includes(c), `categoria fora da lista: ${c}`);
    }
  }
});

test("data: hoje, ontem, anteontem, dia N, dd/mm, extenso", () => {
  assert.equal(p("paguei 100 reais hoje").date, "2026-11-02");
  assert.equal(p("paguei 100 reais ontem").date, "2026-11-01");
  assert.equal(p("paguei 100 reais anteontem").date, "2026-10-31");
  assert.equal(p("paguei 100 reais dia 15/10").date, "2026-10-15");
  assert.equal(p("paguei 100 reais em 15/10/2026").date, "2026-10-15");
  assert.equal(p("paguei 100 reais no dia 28").date, "2026-10-28"); // dia 28 > hoje (2) → mês passado
  assert.equal(p("paguei 100 reais no dia 1").date, "2026-11-01");
  assert.equal(p("paguei 100 reais em 20 de outubro").date, "2026-10-20");
  assert.equal(p("paguei 100 reais sem data").date, null);
  assert.equal(p("paguei 100 reais dia 31/02").date, null); // inválida
});

test("data: virada de ano", () => {
  assert.equal(parseSpokenEntry("paguei 100 reais dia 20", "2027-01-05").date, "2026-12-20");
  assert.equal(parseSpokenEntry("paguei 100 reais 20 de dezembro", "2027-01-05").date, "2026-12-20");
});

test("descrição: limpa verbo e valor, mantém o resto", () => {
  const r = p("Paguei 150 reais de diesel no posto Ipiranga ontem");
  assert.equal(r.description, "Diesel no posto Ipiranga");
  assert.equal(p("Nota fiscal de 89,90 do mercado Bom Preço").description, "Mercado Bom Preço");
  assert.equal(p("Recebi 3200 reais da Fazenda Boa Vista").description, "Fazenda Boa Vista");
  assert.equal(p("gastei 85 reais no almoço da equipe").description, "Almoço da equipe");
});

test("frase completa de ponta a ponta", () => {
  const r = p("Nota fiscal de cento e vinte reais e cinquenta centavos, abasteci 30 litros de diesel no posto Shell ontem");
  assert.equal(r.amount, 120.5);
  assert.equal(r.tipo, "saida");
  assert.equal(r.category, "Combustível / abastecimento");
  assert.equal(r.date, "2026-11-01");
  assert.equal(r.status, "pago");
});

test("texto vazio ou sem sentido não quebra", () => {
  assert.deepEqual(p(""), { tipo: null, amount: null, date: null, status: null, category: null, description: null });
  const r = p("bom dia tudo bem");
  assert.equal(r.amount, null);
  assert.equal(r.tipo, null);
});

test("descrição: a data falada não fica grudada no texto", () => {
  assert.equal(p("Recebi três mil e quinhentos reais da Fazenda Boa Vista, serviço de 40 hectares, dia 28/10").description, "Fazenda Boa Vista, serviço de 40 hectares");
  assert.equal(p("Paguei 150 reais de diesel no posto Ipiranga em 15/10/2026").description, "Diesel no posto Ipiranga");
  assert.equal(p("Paguei 150 reais de diesel no posto Ipiranga ontem").description, "Diesel no posto Ipiranga");
});

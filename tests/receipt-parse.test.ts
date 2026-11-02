import test from "node:test";
import assert from "node:assert/strict";
import { findTotal, findReceiptDate, findMerchant, parseReceiptText } from "../lib/receipt-parse.ts";

const TODAY = "2026-11-02";

const CUPOM_POSTO = `
POSTO IPIRANGA LTDA
CNPJ: 12.345.678/0001-90
Av. Joaquim Teotonio Segurado, 1200
DOCUMENTO AUXILIAR DA NOTA FISCAL
DE CONSUMIDOR ELETRONICA
Data: 28/10/2026 14:32:10
ITEM  DESCRICAO      QTD   UN    VL UNIT   VL TOTAL
001   DIESEL S10     38,000 L    6,19      235,22
SUBTOTAL R$ 235,22
DESCONTO R$ 0,00
VALOR TOTAL R$ 235,22
FORMA DE PAGAMENTO  CARTAO   235,22
`;

test("total: usa 'VALOR TOTAL' e ignora subtotal e itens", () => {
  assert.equal(findTotal(CUPOM_POSTO), 235.22);
});

test("total: 'VALOR A PAGAR' ganha de 'TOTAL'", () => {
  assert.equal(findTotal("ITEM 1  10,00\nTOTAL 50,00\nVALOR A PAGAR R$ 45,00"), 45);
});

test("total: valor na linha de baixo do rótulo", () => {
  assert.equal(findTotal("MERCADO BOM PRECO\nTOTAL R$\n89,90"), 89.9);
});

test("total: milhar e erro de OCR (O no lugar de 0)", () => {
  assert.equal(findTotal("VALOR TOTAL R$ 1.234,56"), 1234.56);
  assert.equal(findTotal("TOTAL R$ 1O5,3O"), 105.3);
});

test("total: sem rótulo, usa o maior valor com centavos", () => {
  assert.equal(findTotal("ARROZ 12,50\nFEIJAO 9,90\nCARNE 48,00"), 48);
  assert.equal(findTotal("sem valores aqui"), null);
});

test("data: pega a primeira data válida e não futura", () => {
  assert.equal(findReceiptDate(CUPOM_POSTO, TODAY), "2026-10-28");
  assert.equal(findReceiptDate("Emissao 05/11/2026", TODAY), null); // futura
  assert.equal(findReceiptDate("31/02/2026", TODAY), null);
  assert.equal(findReceiptDate("data 15-10-26", TODAY), "2026-10-15");
});

test("estabelecimento: primeira linha que parece nome, pulando CNPJ/endereço", () => {
  assert.equal(findMerchant(CUPOM_POSTO), "POSTO IPIRANGA LTDA");
  assert.equal(findMerchant("CNPJ 12.345.678/0001-90\nSUPERMERCADO BOM PRECO\nRua A"), "SUPERMERCADO BOM PRECO");
});

test("cupom completo: valor, data, descrição, categoria e tipo", () => {
  const r = parseReceiptText(CUPOM_POSTO, TODAY);
  assert.equal(r.amount, 235.22);
  assert.equal(r.date, "2026-10-28");
  assert.equal(r.description, "Posto Ipiranga Ltda");
  assert.equal(r.category, "Combustível / abastecimento");
  assert.equal(r.tipo, "saida");
});

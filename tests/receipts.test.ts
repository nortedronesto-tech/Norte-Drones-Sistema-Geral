import test from "node:test";
import assert from "node:assert/strict";
import { receiptList, receiptJoin, addReceipt } from "../lib/receipts.ts";

test("um caminho só continua igual; vazio vira lista vazia", () => {
  assert.deepEqual(receiptList("2026/11/a.jpg"), ["2026/11/a.jpg"]);
  assert.deepEqual(receiptList(null), []);
  assert.deepEqual(receiptList(""), []);
});
test("vários caminhos entram e saem na ordem", () => {
  const s = receiptJoin(["2026/11/a.jpg", "2026/11/b.jpg"]);
  assert.equal(s, "2026/11/a.jpg|2026/11/b.jpg");
  assert.deepEqual(receiptList(s), ["2026/11/a.jpg", "2026/11/b.jpg"]);
});
test("adicionar não duplica o mesmo caminho", () => {
  assert.equal(addReceipt("2026/11/a.jpg", "2026/11/a.jpg"), "2026/11/a.jpg");
  assert.equal(addReceipt(null, "2026/11/a.jpg"), "2026/11/a.jpg");
  assert.equal(addReceipt("2026/11/a.jpg", "2026/11/b.jpg"), "2026/11/a.jpg|2026/11/b.jpg");
});

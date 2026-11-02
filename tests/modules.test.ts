import test from "node:test";
import assert from "node:assert/strict";
import { modulesFor } from "../lib/modules.ts";

const ids = (role: Parameters<typeof modulesFor>[0]) => modulesFor(role).map((g) => g.id);
const links = (role: Parameters<typeof modulesFor>[0]) => modulesFor(role).flatMap((g) => g.items.map((i) => i.href));

test("operador vê só Operação e Campo, sem nada de financeiro, valores ou admin", () => {
  assert.deepEqual(ids("operador"), ["operacao", "campo"]);
  const l = links("operador");
  assert.ok(l.includes("/gestao/os/nova") && l.includes("/gestao/os") && l.includes("/gestao/campo/pulverizacao"));
  for (const bad of ["/gestao/lancamentos", "/gestao/contas-a-receber", "/gestao/clientes", "/gestao/relatorios", "/gestao/cadastros", "/gestao/marketing/posts", "/gestao/sistema/usuarios"]) {
    assert.ok(!l.includes(bad), `operador não deveria ver ${bad}`);
  }
});

test("consulta não cria OS; financeiro e admin enxergam o que lhes cabe", () => {
  assert.ok(!links("consulta").includes("/gestao/os/nova"));
  assert.ok(links("financeiro").includes("/gestao/os/nova") && links("financeiro").includes("/gestao/conciliacao"));
  assert.ok(!links("financeiro").includes("/gestao/sistema/usuarios"));
  assert.ok(links("admin").includes("/gestao/sistema/usuarios") && ids("admin").includes("marketing"));
});

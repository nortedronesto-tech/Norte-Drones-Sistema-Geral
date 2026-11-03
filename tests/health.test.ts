import test from "node:test";
import assert from "node:assert/strict";
import { ageLevel, ageText, MIGRATION_PROBES, runLevel, worst } from "../lib/health.ts";

const NOW = new Date("2026-11-03T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

test("idade da rotina diária: ok até 36 h, atenção até 72 h, depois falha", () => {
  assert.equal(ageLevel(ago(5), NOW, 36, 72), "ok");
  assert.equal(ageLevel(ago(36.5), NOW, 36, 72), "warn");
  assert.equal(ageLevel(ago(73), NOW, 36, 72), "fail");
  assert.equal(ageLevel(null, NOW, 36, 72), "fail");
  assert.equal(ageLevel("lixo", NOW, 36, 72), "fail");
});

test("execução que falhou pesa mais do que a idade", () => {
  assert.equal(runLevel({ at: ago(1), ok: false, note: "Resend 401" }, NOW, 36, 72), "fail");
  assert.equal(runLevel({ at: ago(1), ok: true }, NOW, 36, 72), "ok");
  assert.equal(runLevel(null, NOW, 36, 72), "fail");
});

test("texto de idade em português", () => {
  assert.equal(ageText(ago(0.01), NOW), "agora há pouco");
  assert.equal(ageText(ago(0.5), NOW), "há 30 minutos");
  assert.equal(ageText(ago(1), NOW), "há 1 hora");
  assert.equal(ageText(ago(5), NOW), "há 5 horas");
  assert.equal(ageText(ago(24 * 5), NOW), "há 5 dias");
  assert.equal(ageText(null, NOW), "nunca rodou");
});

test("o pior nível manda", () => {
  assert.equal(worst(["ok", "ok"]), "ok");
  assert.equal(worst(["ok", "warn"]), "warn");
  assert.equal(worst(["warn", "fail", "ok"]), "fail");
  assert.equal(worst([]), "ok");
});

test("lista de migrations monitoradas é única e completa", () => {
  assert.equal(new Set(MIGRATION_PROBES.map((m) => m.id)).size, MIGRATION_PROBES.length);
  assert.ok(MIGRATION_PROBES.some((m) => m.id === "0015") && MIGRATION_PROBES.some((m) => m.id === "0007"));
});

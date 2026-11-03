import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClima, openMeteoUrl, parseOpenMeteo } from "../lib/clima.ts";

test("condições boas: tudo verde", () => {
  const r = evaluateClima({ windKmh: 6, gustKmh: 10, tempC: 26, humidityPct: 70, rainNowMm: 0, rainProbNext: 10 });
  assert.equal(r.level, "bom");
  assert.ok(r.factors.every((f) => f.level === "bom"));
});

test("vento: limites 3, 10 e 15 km/h", () => {
  const lv = (w: number) => evaluateClima({ windKmh: w }).level;
  assert.equal(lv(2.9), "atencao"); // calmaria
  assert.equal(lv(3), "bom");
  assert.equal(lv(10), "bom");
  assert.equal(lv(10.1), "atencao");
  assert.equal(lv(15), "atencao");
  assert.equal(lv(15.1), "nao");
});

test("temperatura e umidade: 30/35 °C e 60/50 %", () => {
  assert.equal(evaluateClima({ tempC: 30 }).level, "bom");
  assert.equal(evaluateClima({ tempC: 31 }).level, "atencao");
  assert.equal(evaluateClima({ tempC: 36 }).level, "nao");
  assert.equal(evaluateClima({ humidityPct: 60 }).level, "bom");
  assert.equal(evaluateClima({ humidityPct: 55 }).level, "atencao");
  assert.equal(evaluateClima({ humidityPct: 49 }).level, "nao");
});

test("chuva agora ou chance alta barra a aplicação; rajada forte também", () => {
  assert.equal(evaluateClima({ rainNowMm: 0.2 }).level, "nao");
  assert.equal(evaluateClima({ rainProbNext: 75 }).level, "nao");
  assert.equal(evaluateClima({ rainProbNext: 50 }).level, "atencao");
  assert.equal(evaluateClima({ windKmh: 8, gustKmh: 25 }).level, "nao");
});

test("o pior fator manda e os motivos aparecem", () => {
  const r = evaluateClima({ windKmh: 6, tempC: 33, humidityPct: 45 });
  assert.equal(r.level, "nao");
  assert.equal(r.factors.find((f) => f.id === "umidade")?.level, "nao");
  assert.equal(r.factors.find((f) => f.id === "temperatura")?.level, "atencao");
  assert.match(r.factors.find((f) => f.id === "umidade")!.text, /seco/);
});

test("sem nenhum dado: não inventa nada", () => {
  const r = evaluateClima({});
  assert.deepEqual(r, { level: "bom", factors: [] });
  assert.deepEqual(evaluateClima({ windKmh: null, tempC: undefined }).factors, []);
});

test("lê a resposta da Open-Meteo (formato real)", () => {
  const json = {
    current: { time: "2026-11-02T21:45", temperature_2m: 28.2, relative_humidity_2m: 89, wind_speed_10m: 4.5, wind_gusts_10m: 10.4, precipitation: 0 },
    hourly: { precipitation_probability: [4, 0, 0, 62] },
  };
  assert.deepEqual(parseOpenMeteo(json), { windKmh: 4.5, gustKmh: 10.4, tempC: 28.2, humidityPct: 89, rainNowMm: 0, rainProbNext: 62 });
  assert.equal(parseOpenMeteo({}), null);
  assert.equal(parseOpenMeteo(null), null);
  assert.equal(parseOpenMeteo({ current: { time: "x" } }), null);
});

test("endereço da previsão leva o ponto, vento em km/h e fuso de Tocantins", () => {
  const u = new URL(openMeteoUrl(-10.2491, -48.3243));
  assert.equal(u.hostname, "api.open-meteo.com");
  assert.equal(u.searchParams.get("latitude"), "-10.2491");
  assert.equal(u.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(u.searchParams.get("timezone"), "America/Araguaina");
});

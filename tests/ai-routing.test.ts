import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyFailure,
  detectProvider,
  normalizeConfig,
  pickCandidates,
  DEFAULT_ORDER,
  type AiConfig,
} from "../lib/ai-routing.ts";

const k = (prefix: string, n = 30) => prefix + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6".repeat(2).slice(0, n);

test("detecta Gemini, Grok, Groq e OpenAI pelo formato da chave", () => {
  assert.deepEqual(detectProvider(k("AIza", 35)).ok && (detectProvider(k("AIza", 35)) as any).provider, "gemini");
  assert.equal((detectProvider(k("xai-")) as any).provider, "grok");
  assert.equal((detectProvider(k("gsk_")) as any).provider, "groq");
  assert.equal((detectProvider(k("sk-")) as any).provider, "openai");
  assert.equal((detectProvider(k("sk-proj-")) as any).provider, "openai");
});

test("chave da Anthropic não vira OpenAI por engano", () => {
  const r = detectProvider(k("sk-ant-api03-"));
  assert.equal(r.ok, false);
  assert.match((r as any).error, /Anthropic/);
});

test("rejeita chave curta, com espaço ou desconhecida; aceita aspas e espaços nas pontas", () => {
  assert.equal(detectProvider("abc").ok, false);
  assert.equal(detectProvider("sk-aaaaaaaaaaaaaaaaaaaaaaaa bbbb").ok, false);
  assert.equal(detectProvider("qualquercoisaaaaaaaaaaaaaaaaaaaa").ok, false);
  const r = detectProvider(`  "${k("gsk_")}"  `);
  assert.equal(r.ok, true);
  assert.equal((r as any).key, k("gsk_"));
});

test("classifica falhas", () => {
  assert.equal(classifyFailure(429, '{"error":{"code":"insufficient_quota"}}'), "credit");
  assert.equal(classifyFailure(402, ""), "credit");
  assert.equal(classifyFailure(403, "Your team has no credits"), "credit");
  assert.equal(classifyFailure(429, "You exceeded your current quota, please check your plan and billing details"), "credit");
});

test("429 de limite por minuto é 'rate', não 'credit'", () => {
  assert.equal(classifyFailure(429, "Rate limit reached for requests per minute"), "rate");
  assert.equal(classifyFailure(429, "RESOURCE_EXHAUSTED"), "rate");
});

test("401 = chave inválida; 404 = modelo; 500 = transitório; null = transitório", () => {
  assert.equal(classifyFailure(401, "Incorrect API key"), "invalid");
  assert.equal(classifyFailure(403, "API key not valid"), "invalid");
  assert.equal(classifyFailure(404, "model not found"), "model");
  assert.equal(classifyFailure(503, ""), "transient");
  assert.equal(classifyFailure(null, ""), "transient");
  assert.equal(classifyFailure(400, "something odd"), "other");
});

test("config vazia ou lixo vira config válida com todas as IAs na ordem padrão", () => {
  for (const raw of [null, undefined, "x", 5, {}, { order: "oi" }]) {
    const c = normalizeConfig(raw);
    assert.deepEqual(c.order, DEFAULT_ORDER);
    assert.deepEqual(c.disabled, []);
  }
});

test("ordem do usuário é respeitada e IAs faltantes entram no fim", () => {
  const c = normalizeConfig({ order: ["openai", "gemini", "x"] });
  assert.deepEqual(c.order, ["openai", "gemini", "grok", "groq"]);
});

const now = Date.parse("2026-10-30T12:00:00Z");
const base = (patch: Partial<AiConfig> = {}): AiConfig => ({ ...normalizeConfig({ order: ["gemini", "grok", "openai"] }), ...patch });

test("usa a 1ª com chave; ignora as sem chave", () => {
  const c = pickCandidates(base(), (p) => p !== "gemini", now);
  assert.deepEqual(c.first, ["grok", "openai", "groq"]);
});

test("IA sem crédito (de molho) vai para o fim; a próxima assume", () => {
  const cfg = base({ status: { gemini: { state: "limit", until: "2026-10-30T15:00:00Z", at: "x" } } });
  const c = pickCandidates(cfg, () => true, now);
  assert.deepEqual(c.first, ["grok", "openai", "groq"]);
  assert.deepEqual(c.later, ["gemini"]);
});

test("passado o tempo de molho, a IA volta sozinha para a frente", () => {
  const cfg = base({ status: { gemini: { state: "limit", until: "2026-10-30T11:00:00Z", at: "x" } } });
  assert.deepEqual(pickCandidates(cfg, () => true, now).first[0], "gemini");
});

test("chave inválida e IA desativada nunca são tentadas", () => {
  const cfg = base({ disabled: ["grok"], status: { gemini: { state: "invalid", at: "x" } } });
  const c = pickCandidates(cfg, () => true, now);
  assert.deepEqual(c.first, ["openai", "groq"]);
  assert.deepEqual(c.later, []);
});

// ------------------------------------------------ troca automática (orchestrate)
import { orchestrate, type AiProvider, type OrchestrateDeps } from "../lib/ai-routing.ts";

function fakeDeps(opts: { keys?: AiProvider[]; cfg?: Partial<AiConfig>; now?: number } = {}) {
  const keys = opts.keys ?? ["gemini", "grok", "openai"];
  let saved: AiConfig = { ...normalizeConfig({ order: ["gemini", "grok", "openai"] }), ...opts.cfg };
  const clock = { t: opts.now ?? Date.parse("2026-10-30T12:00:00Z") };
  const deps: OrchestrateDeps = {
    load: async () => structuredClone(saved),
    save: async (c) => { saved = structuredClone(c); },
    hasKey: { gemini: keys.includes("gemini"), grok: keys.includes("grok"), groq: keys.includes("groq"), openai: keys.includes("openai") },
    getKey: async (p) => (keys.includes(p) ? `key-${p}` : null),
    modelFor: (_c, p) => `model-${p}`,
    now: () => clock.t,
  };
  return { deps, get cfg() { return saved; }, clock };
}
const err = (failure: "credit" | "rate" | "invalid" | "transient" | "model", message = "x") => Object.assign(new Error(message), { failure });

test("orchestrate: usa a 1ª IA e registra 'em uso'", async () => {
  const f = fakeDeps();
  const r: any = await orchestrate(f.deps, async (p) => `leu com ${p}`);
  assert.equal(r.provider, "gemini");
  assert.equal(r.value, "leu com gemini");
  assert.equal(f.cfg.status.gemini?.state, "ok");
  assert.equal(f.cfg.lastUsed?.provider, "gemini");
});

test("orchestrate: Gemini sem crédito → Grok assume; Gemini fica de molho", async () => {
  const f = fakeDeps();
  const calls: string[] = [];
  const r: any = await orchestrate(f.deps, async (p) => { calls.push(p); if (p === "gemini") throw err("credit"); return "ok"; });
  assert.equal(r.provider, "grok");
  assert.deepEqual(calls, ["gemini", "grok"]);
  assert.equal(f.cfg.status.gemini?.state, "limit");
  assert.ok(Date.parse(f.cfg.status.gemini!.until!) > f.clock.t);
});

test("orchestrate: na leitura seguinte já começa pelo Grok (não perde tempo com o Gemini sem crédito)", async () => {
  const f = fakeDeps();
  await orchestrate(f.deps, async (p) => { if (p === "gemini") throw err("credit"); return "ok"; });
  const calls: string[] = [];
  await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.deepEqual(calls, ["grok"]);
});

test("orchestrate: Gemini e Grok sem crédito → OpenAI", async () => {
  const f = fakeDeps();
  const r: any = await orchestrate(f.deps, async (p) => { if (p !== "openai") throw err("credit"); return "ok"; });
  assert.equal(r.provider, "openai");
});

test("orchestrate: passadas 3h o Gemini volta a ser a 1ª opção", async () => {
  const f = fakeDeps();
  await orchestrate(f.deps, async (p) => { if (p === "gemini") throw err("credit"); return "ok"; });
  f.clock.t += 3 * 60 * 60 * 1000 + 1000;
  const calls: string[] = [];
  const r: any = await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.equal(r.provider, "gemini");
  assert.equal(f.cfg.status.gemini?.state, "ok");
});

test("orchestrate: chave inválida é marcada e nunca mais tentada", async () => {
  const f = fakeDeps();
  await orchestrate(f.deps, async (p) => { if (p === "gemini") throw err("invalid"); return "ok"; });
  assert.equal(f.cfg.status.gemini?.state, "invalid");
  const calls: string[] = [];
  await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.ok(!calls.includes("gemini"));
});

test("orchestrate: falha passageira (sem internet) passa para a próxima mas NÃO põe a IA de molho", async () => {
  const f = fakeDeps();
  const r: any = await orchestrate(f.deps, async (p) => { if (p === "gemini") throw err("transient", "timeout"); return "ok"; });
  assert.equal(r.provider, "grok");
  assert.equal(f.cfg.status.gemini?.state, "error");
  const calls: string[] = [];
  await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.equal(calls[0], "gemini"); // tenta o Gemini de novo
});

test("orchestrate: todas falham → devolve as tentativas (para explicar ao usuário)", async () => {
  const f = fakeDeps();
  const r: any = await orchestrate(f.deps, async () => { throw err("credit", "sem saldo"); });
  assert.equal(r.none, false);
  assert.deepEqual(r.attempts.map((a: any) => a.provider), ["gemini", "grok", "openai"]);
  assert.equal(r.attempts[0].error.message, "sem saldo");
});

test("orchestrate: IAs de molho ainda são tentadas como último recurso", async () => {
  const f = fakeDeps({ keys: ["gemini"], cfg: { status: { gemini: { state: "limit", until: "2026-10-30T18:00:00Z", at: "x" } } } });
  const calls: string[] = [];
  const r: any = await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.deepEqual(calls, ["gemini"]);
  assert.equal(r.provider, "gemini");
});

test("orchestrate: sem nenhuma chave cadastrada → none", async () => {
  const f = fakeDeps({ keys: [] });
  const r: any = await orchestrate(f.deps, async () => "ok");
  assert.equal(r.none, true);
  assert.deepEqual(r.attempts, []);
});

test("orchestrate: erro 'fatal' (foto ilegível) não troca de IA nem pune ninguém", async () => {
  const f = fakeDeps();
  class Unreadable extends Error {}
  await assert.rejects(
    orchestrate(f.deps, async () => { throw new Unreadable(); }, (e) => e instanceof Unreadable),
    Unreadable,
  );
  assert.deepEqual(f.cfg.status, {});
});

test("orchestrate: IA desativada pelo usuário é pulada", async () => {
  const f = fakeDeps({ cfg: { disabled: ["gemini"] } });
  const calls: string[] = [];
  await orchestrate(f.deps, async (p) => { calls.push(p); return "ok"; });
  assert.deepEqual(calls, ["grok"]);
});

test("orchestrate: ordem escolhida pelo usuário manda (OpenAI primeiro)", async () => {
  const f = fakeDeps({ cfg: normalizeConfig({ order: ["openai", "gemini", "grok"] }) });
  const r: any = await orchestrate(f.deps, async (p) => p);
  assert.equal(r.provider, "openai");
});

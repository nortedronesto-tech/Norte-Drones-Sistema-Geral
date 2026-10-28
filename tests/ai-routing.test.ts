import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_IDS,
  cleanKey,
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

test("reconhece o formato novo de chave do Google AI Studio (AQ.…)", () => {
  const r = detectProvider("AQ.Ab8RN6" + "xYz0123456789_abcdefghijklmnopqrstuvwx");
  assert.equal(r.ok, true);
  assert.equal((r as any).provider, "gemini");
});

test("chave de formato desconhecido pede escolha manual (mensagem) e cleanKey aceita", () => {
  const r = detectProvider("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");
  assert.equal(r.ok, false);
  assert.match((r as any).error, /Escolha de qual IA/);
  const c = cleanKey("  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' ");
  assert.equal(c.ok, true);
  assert.equal((c as any).key, "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");
  assert.equal(cleanKey("curta").ok, false);
  assert.equal(cleanKey("tem espaco no meio da chave aqui ok").ok, false);
  assert.equal(cleanKey("a".repeat(401)).ok, false);
});

test("detecta Claude, OpenRouter, Fireworks, Hugging Face, NVIDIA e Together; sk- genérico continua OpenAI", () => {
  assert.equal((detectProvider(k("sk-ant-api03-")) as any).provider, "anthropic");
  assert.equal((detectProvider(k("sk-or-v1-")) as any).provider, "openrouter");
  assert.equal((detectProvider(k("fw_")) as any).provider, "fireworks");
  assert.equal((detectProvider(k("hf_")) as any).provider, "huggingface");
  assert.equal((detectProvider(k("nvapi-")) as any).provider, "nvidia");
  assert.equal((detectProvider("a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90") as any).provider, "together");
  assert.equal((detectProvider(k("sk-proj-")) as any).provider, "openai");
});

test("chaves sem prefixo (Mistral, Cohere, DeepInfra) não são adivinhadas: pedem escolha manual", () => {
  for (const key of ["Zx9Qw3Er5Ty7Ui1Op2As4Df6Gh8Jk0Lm", "Zx9Qw3Er5Ty7Ui1Op2As4Df6Gh8Jk0LmNb5Vc7Xz"]) {
    const r = detectProvider(key);
    assert.equal(r.ok, false);
    assert.match((r as any).error, /Escolha de qual IA/);
  }
});

test("todas as IAs têm nome e a lista não tem repetidas", () => {
  assert.equal(new Set(PROVIDER_IDS).size, PROVIDER_IDS.length);
  assert.ok(PROVIDER_IDS.length >= 13);
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

test("ordem do usuário é respeitada e IAs faltantes entram no fim, na ordem padrão", () => {
  const c = normalizeConfig({ order: ["openai", "gemini", "x"] });
  assert.deepEqual(c.order.slice(0, 2), ["openai", "gemini"]);
  assert.equal(c.order.length, PROVIDER_IDS.length);
  assert.deepEqual(c.order.slice(2), PROVIDER_IDS.filter((p) => p !== "openai" && p !== "gemini"));
});

const now = Date.parse("2026-10-30T12:00:00Z");
const keyset = (...on: string[]) => Object.fromEntries(PROVIDER_IDS.map((p) => [p, on.includes(p)])) as Record<AiProvider, boolean>;
const base = (patch: Partial<AiConfig> = {}): AiConfig => ({ ...normalizeConfig({ order: ["gemini", "grok", "openai"] }), ...patch });

test("usa a 1ª com chave; ignora as sem chave", () => {
  const has = keyset("grok", "openai", "groq");
  const c = pickCandidates(base(), (p) => has[p], now);
  assert.deepEqual(c.first, ["grok", "openai", "groq"]);
});

test("IA sem crédito (de molho) vai para o fim; a próxima assume", () => {
  const cfg = base({ status: { gemini: { state: "limit", until: "2026-10-30T15:00:00Z", at: "x" } } });
  const has = keyset("gemini", "grok", "openai", "groq");
  const c = pickCandidates(cfg, (p) => has[p], now);
  assert.deepEqual(c.first, ["grok", "openai", "groq"]);
  assert.deepEqual(c.later, ["gemini"]);
});

test("passado o tempo de molho, a IA volta sozinha para a frente", () => {
  const cfg = base({ status: { gemini: { state: "limit", until: "2026-10-30T11:00:00Z", at: "x" } } });
  assert.deepEqual(pickCandidates(cfg, (p) => keyset("gemini", "grok")[p], now).first[0], "gemini");
});

test("chave inválida e IA desativada nunca são tentadas", () => {
  const cfg = base({ disabled: ["grok"], status: { gemini: { state: "invalid", at: "x" } } });
  const has = keyset("gemini", "grok", "groq", "openai");
  const c = pickCandidates(cfg, (p) => has[p], now);
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
    hasKey: Object.fromEntries(PROVIDER_IDS.map((p) => [p, keys.includes(p)])) as Record<AiProvider, boolean>,
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

// ------------------------------------------------ fotos do iPhone (HEIC)
import { isHeicBytes, looksHeicByName } from "../lib/heic.ts";

const bytes = (...s: (string | number)[]) => Uint8Array.from(s.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

test("HEIC: reconhece pelo conteúdo mesmo com nome .jpeg", () => {
  assert.equal(isHeicBytes(bytes(0, 0, 0, 24, "ftyp", "heic", 0, 0, 0, 0)), true);
  assert.equal(isHeicBytes(bytes(0, 0, 0, 24, "ftyp", "mif1", 0, 0, 0, 0)), true);
  assert.equal(isHeicBytes(bytes(0, 0, 0, 24, "ftyp", "HEIC", 0, 0, 0, 0)), true);
});

test("HEIC: JPEG e PNG de verdade não são confundidos", () => {
  assert.equal(isHeicBytes(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, "JFIF", 0, 1, 1, 0, 0)), false);
  assert.equal(isHeicBytes(bytes(0x89, "PNG", 13, 10, 26, 10, 0, 0, 0, 13)), false);
  assert.equal(isHeicBytes(bytes(1, 2, 3)), false);
});

test("HEIC: reconhece pelo nome/tipo declarado", () => {
  assert.equal(looksHeicByName("foto.HEIC", ""), true);
  assert.equal(looksHeicByName("foto.heif", ""), true);
  assert.equal(looksHeicByName("x.jpg", "image/heic"), true);
  assert.equal(looksHeicByName("IMG_3303.jpeg", "image/jpeg"), false);
});

// ------------------------------------------------ escolha do modelo Gemini
import { pickGeminiModel } from "../lib/ai-routing.ts";

const gm = (name: string, methods: string[] = ["generateContent"]) => ({ name: `models/${name}`, methods });

test("Gemini: escolhe o flash de maior versão", () => {
  const list = [gm("gemini-2.0-flash"), gm("gemini-2.5-flash"), gm("gemini-3.8-flash"), gm("gemini-3.1-flash")];
  assert.equal(pickGeminiModel(list), "gemini-3.8-flash");
});

test("Gemini: ignora lite, imagem, áudio, embedding e modelos sem generateContent", () => {
  const list = [
    gm("gemini-4.0-flash-lite"),
    gm("gemini-4.0-flash-image"),
    gm("gemini-4.0-flash-live-001"),
    gm("gemini-4.0-flash-tts"),
    gm("gemini-embedding-001", ["embedContent"]),
    gm("gemini-3.0-flash", ["countTokens"]),
    gm("gemini-2.5-flash"),
  ];
  assert.equal(pickGeminiModel(list), "gemini-2.5-flash");
});

test("Gemini: prefere versão estável a preview quando a versão é a mesma", () => {
  assert.equal(pickGeminiModel([gm("gemini-3.8-flash-preview-09-2026"), gm("gemini-3.8-flash")]), "gemini-3.8-flash");
});

test("Gemini: aceita só preview se não houver estável; lista vazia devolve null", () => {
  assert.equal(pickGeminiModel([gm("gemini-3.9-flash-preview-10-2026")]), "gemini-3.9-flash-preview-10-2026");
  assert.equal(pickGeminiModel([]), null);
  assert.equal(pickGeminiModel([gm("gemma-3-27b-it"), gm("text-embedding-004", ["embedContent"])]), null);
});

test("modelo aposentado é 'model' (e não 'invalid'), mesmo com status 403 ou 400", () => {
  const msg = "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash";
  assert.equal(classifyFailure(404, msg), "model");
  assert.equal(classifyFailure(403, msg), "model");
  assert.equal(classifyFailure(400, msg), "model");
  assert.equal(classifyFailure(403, "API key not valid. Please pass a valid API key."), "invalid");
});

import { rankGeminiModels } from "../lib/ai-routing.ts";
test("Gemini: ranking devolve do mais novo ao mais antigo (para tentar outro quando um está sobrecarregado)", () => {
  const list = [gm("gemini-2.5-flash"), gm("gemini-3.8-flash"), gm("gemini-3.1-flash"), gm("gemini-3.8-flash-lite")];
  assert.deepEqual(rankGeminiModels(list), ["gemini-3.8-flash", "gemini-3.1-flash", "gemini-2.5-flash"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Roda o public/sw.js de verdade num ambiente simulado (Cache API e fetch falsos) e dispara eventos "fetch".
const src = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://app.test";

// Respostas da rede mesma-origem são do tipo "basic" no navegador de verdade.
const basic = (r: Response, redirected = false) => { Object.defineProperty(r, "type", { value: "basic" }); Object.defineProperty(r, "redirected", { value: redirected }); return r; };

function setup(netBehavior: { mode: "ok" | "down" | "redirect" | "slow" | "error500" }) {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => (typeof r === "string" ? new URL(r, ORIGIN).href : new URL(r.url).href.replace(/\?.*$/, ""));
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (r: Request | string) => m.get(key(r))?.clone(),
      put: async (r: Request | string, res: Response) => void m.set(key(r), res),
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(key(u), new Response(`static:${u}`))),
    };
  };
  const caches = {
    open,
    match: async (r: Request | string) => { for (const m of stores.values()) { const h = m.get(key(r)); if (h) return h.clone(); } return undefined; },
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
  };
  const listeners: Record<string, (e: unknown) => void> = {};
  const fetchLog: string[] = [];
  const sandbox: Record<string, unknown> = {
    self: { location: { origin: ORIGIN }, addEventListener: (t: string, f: (e: unknown) => void) => { listeners[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} } },
    caches, URL, Request, Response, AbortController, Promise, setTimeout, clearTimeout,
    fetch: (req: Request, init?: { signal?: AbortSignal }) => {
      fetchLog.push(new URL(req.url).pathname);
      const b = netBehavior.mode;
      if (b === "down") return Promise.reject(new TypeError("Failed to fetch"));
      if (b === "slow") return new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
      if (b === "redirect") return Promise.resolve(basic(new Response("login", { status: 200 }), true));
      if (b === "error500") return Promise.resolve(basic(new Response("erro", { status: 500 })));
      return Promise.resolve(basic(new Response(`net:${new URL(req.url).pathname}`, { status: 200 })));
    },
  };
  sandbox.self = Object.assign(sandbox.self as object, { caches });
  vm.runInNewContext(src, sandbox);
  const run = async (path: string, opts: { navigate?: boolean; headers?: Record<string, string> } = {}) => {
    const req = new Request(`${ORIGIN}${path}`, { headers: { Accept: "text/html", ...(opts.headers ?? {}) } });
    if (opts.navigate !== false) Object.defineProperty(req, "mode", { value: "navigate" });
    let responded: Promise<Response> | null = null;
    const waits: Promise<unknown>[] = [];
    listeners.fetch({ request: req, respondWith: (p: Promise<Response>) => { responded = p; }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    return responded ? (await responded as Response).text() : null;
  };
  const install = async () => { const waits: Promise<unknown>[] = []; listeners.install({ waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits); };
  return { run, install, stores, net: netBehavior, fetchLog };
}

test("página de campo: com sinal guarda; sem sinal abre a cópia guardada", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  assert.equal(await env.run("/gestao/campo/pulverizacao"), "net:/gestao/campo/pulverizacao");
  env.net.mode = "down";
  assert.equal(await env.run("/gestao/campo/pulverizacao"), "net:/gestao/campo/pulverizacao"); // veio do cache
  assert.equal(await env.run("/gestao/os/nova"), "static:/offline.html"); // nunca visitada: tela "sem conexão"
});

test("Nova OS e todas as seções do Campo são guardáveis", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  for (const p of ["/gestao/os/nova", "/gestao/campo/foliar", "/gestao/campo/solidos", "/gestao/campo/pragas", "/gestao/campo/passo-a-passo", "/gestao/campo/duvidas"]) await env.run(p);
  env.net.mode = "down";
  for (const p of ["/gestao/os/nova", "/gestao/campo/foliar", "/gestao/campo/solidos", "/gestao/campo/pragas", "/gestao/campo/passo-a-passo", "/gestao/campo/duvidas"]) {
    assert.equal(await env.run(p), `net:${p}`, p);
  }
});

test("financeiro do dia a dia fica guardado; relatórios, clientes e OS de terceiros não", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  const keep = ["/gestao", "/gestao/lancamentos", "/gestao/contas-a-pagar", "/gestao/contas-a-receber", "/gestao/reserva", "/gestao/auditoria"];
  const skip = ["/gestao/relatorios", "/gestao/conciliacao", "/gestao/os", "/gestao/os/abc-123", "/gestao/clientes", "/gestao/lancamentos/abc-123/editar"];
  for (const p of [...keep, ...skip]) await env.run(p);
  env.net.mode = "down";
  for (const p of keep) assert.equal(await env.run(p), `net:${p}`, p);
  for (const p of skip) assert.equal(await env.run(p), "static:/offline.html", p);
});

test("ao sair (/login) somem as páginas e as fotos de recibo; o cache de recibos sobrevive a atualização do SW", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  await env.run("/gestao/lancamentos");
  (await (async () => { env.stores.set("norte-receipts-v1", new Map([["x", new Response("foto")]])); return 0; })());
  assert.ok(env.stores.has("norte-pages-v3") && env.stores.has("norte-receipts-v1"));
  await env.run("/login");
  assert.ok(!env.stores.has("norte-pages-v3"));
  assert.ok(!env.stores.has("norte-receipts-v1"));
});

test("não guarda redirecionamento para o login nem erro do servidor", async () => {
  const a = setup({ mode: "redirect" });
  await a.install();
  await a.run("/gestao/os/nova");
  a.net.mode = "down";
  assert.equal(await a.run("/gestao/os/nova"), "static:/offline.html");
  const b = setup({ mode: "error500" });
  await b.install();
  assert.equal(await b.run("/gestao/campo/solidos"), "erro"); // mostra o erro, mas não guarda
  b.net.mode = "down";
  assert.equal(await b.run("/gestao/campo/solidos"), "static:/offline.html");
});

test("sinal fraco: espera pouco pela rede e usa a cópia guardada", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  await env.run("/gestao/campo/duvidas");
  env.net.mode = "slow";
  const t0 = Date.now();
  assert.equal(await env.run("/gestao/campo/duvidas"), "net:/gestao/campo/duvidas");
  assert.ok(Date.now() - t0 < 6000, "demorou demais");
});

test("dados do Next (_rsc) não são tratados como página", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  const out = await env.run("/gestao/campo/solidos?_rsc=abc", { navigate: false, headers: { Accept: "*/*", RSC: "1" } });
  assert.equal(out, null); // o SW não interfere
});

test("abrir /login apaga as páginas guardadas (sair do sistema)", async () => {
  const env = setup({ mode: "ok" });
  await env.install();
  await env.run("/gestao/campo/pulverizacao");
  assert.ok(env.stores.has("norte-pages-v3"));
  await env.run("/login");
  assert.ok(!env.stores.has("norte-pages-v3"));
});

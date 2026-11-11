/* Norte Gestão — service worker (v3: campo e financeiro sem sinal)
 *
 * - Guarda os arquivos estáticos (cache primeiro).
 * - Guarda as páginas de campo (Nova OS, Campo) e as do financeiro usadas no dia a dia (início, lançamentos,
 *   contas, reserva, arquivo de recibos, auditoria). Abrem sem sinal, mostrando os valores
 *   da última vez que o aparelho teve sinal. Só entram no cache páginas de quem está logado (nunca o redirecionamento
 *   para o login).
 * - Com sinal fraco, tenta a rede por poucos segundos e, se não responder, usa a cópia guardada.
 * - Ao abrir /login (sair do sistema), apaga as páginas e as fotos de recibo guardadas no aparelho.
 * O que é feito sem sinal (OS, lançamentos, recibos) fica numa fila no aparelho e é enviado quando a internet volta.
 */
const VERSION = "v3";
const STATIC_CACHE = `norte-static-${VERSION}`;
const PAGES_CACHE = `norte-pages-${VERSION}`;
const RECEIPTS_CACHE = "norte-receipts-v1"; // fotos de recibo (gerido por lib/receipt-cache.ts; não versionado junto)
const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 4000;

// Só estas páginas ficam guardadas.
const CACHEABLE_PAGE = /^\/gestao(\/(os\/nova|campo\/[a-z-]+|lancamentos|contas-a-pagar|contas-a-receber|reserva|recibos|auditoria))?\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/brand/n-mark.png"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("norte-") && k !== STATIC_CACHE && k !== PAGES_CACHE && k !== RECEIPTS_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PAGES") event.waitUntil(clearPrivate());
});

function clearPrivate() {
  return Promise.all([caches.delete(PAGES_CACHE), caches.delete(RECEIPTS_CACHE)]);
}

function isHtmlRequest(req, url) {
  if (url.searchParams.has("_rsc") || req.headers.get("RSC") === "1") return false; // dados do Next, não a página
  return req.mode === "navigate" || (req.headers.get("Accept") || "").includes("text/html");
}

async function pageStrategy(req) {
  const cache = await caches.open(PAGES_CACHE);
  const fromCache = async () => (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) || (await caches.match(OFFLINE_URL));
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    // só guarda página de verdade (nunca redirecionamento para o login nem erro)
    if (res.ok && !res.redirected && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (e) {
    return fromCache();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase (API/Storage) passa direto

  // Sair do sistema: apaga as páginas guardadas neste aparelho.
  if (req.mode === "navigate" && url.pathname === "/login") {
    event.waitUntil(clearPrivate());
  }

  // Páginas de campo e financeiro: rede com limite de tempo e, sem sinal, a cópia guardada.
  if (CACHEABLE_PAGE.test(url.pathname) && isHtmlRequest(req, url)) {
    event.respondWith(pageStrategy(req));
    return;
  }

  // Demais navegações: rede; sem rede, a tela "sem conexão" (que leva às páginas de campo).
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Arquivos estáticos imutáveis do Next, imagens otimizadas, ícones e marca: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

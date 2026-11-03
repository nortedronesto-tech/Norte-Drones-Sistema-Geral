/* Norte Gestão — service worker (v2: trabalho no campo sem sinal)
 *
 * - Guarda os arquivos estáticos (cache primeiro).
 * - Guarda SÓ as páginas de campo: "Nova OS" e o Campo (calculadoras, pragas, passo a passo, dúvidas).
 *   Elas abrem sem sinal. Páginas de financeiro, relatórios e o início NÃO são guardadas.
 * - Com sinal fraco, tenta a rede por poucos segundos e, se não responder, usa a cópia guardada.
 * - Ao abrir /login (sair do sistema), apaga as páginas guardadas.
 * O que é feito sem sinal (OS) fica numa fila no aparelho e é enviado quando a internet volta.
 */
const VERSION = "v2";
const STATIC_CACHE = `norte-static-${VERSION}`;
const PAGES_CACHE = `norte-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 4000;

// Só estas páginas ficam guardadas (nada de dinheiro).
const CACHEABLE_PAGE = /^\/gestao\/(os\/nova|campo\/[a-z-]+)\/?$/;

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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("norte-") && k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGES_CACHE));
});

function isHtmlRequest(req, url) {
  if (url.searchParams.has("_rsc") || req.headers.get("RSC") === "1") return false; // dados do Next, não a página
  return req.mode === "navigate" || (req.headers.get("Accept") || "").includes("text/html");
}

async function pageStrategy(req) {
  const cache = await caches.open(PAGES_CACHE);
  const fromCache = async () => (await cache.match(req, { ignoreSearch: true })) || (await caches.match(OFFLINE_URL));
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
    event.waitUntil(caches.delete(PAGES_CACHE));
  }

  // Páginas de campo: rede com limite de tempo e, sem sinal, a cópia guardada.
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

/* Norte Gestão — service worker (Fase 1)
 *
 * Escopo deliberadamente pequeno: torna o app instalável, acelera o carregamento
 * guardando os arquivos estáticos e mostra uma tela amigável quando não há sinal.
 *
 * NÃO guarda páginas nem respostas da API: elas trazem dados financeiros e não
 * devem ficar em cache no aparelho. O trabalho offline de verdade (fila em
 * IndexedDB para fotos e capturas em campo) entra na Fase 4.
 */
const VERSION = "v1";
const STATIC_CACHE = `norte-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("norte-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase (API/Storage) passa direto

  // Navegação: rede primeiro; sem rede, mostra a página offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Arquivos estáticos imutáveis do Next, ícones e fontes: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
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

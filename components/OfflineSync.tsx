"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, UploadCloud, X } from "lucide-react";
import { ensureClient, saveOS, type OsInput } from "@/app/gestao/os/actions";
import { flushOutbox, readOutbox, removeFromOutbox, retryItem, type KV, type OutboxItem } from "@/lib/outbox";

// Páginas de campo que o service worker guarda para abrir sem sinal (nada de financeiro).
const WARM_PAGES = ["/gestao/os/nova", "/gestao/campo/pulverizacao", "/gestao/campo/foliar", "/gestao/campo/solidos", "/gestao/campo/pragas", "/gestao/campo/passo-a-passo", "/gestao/campo/duvidas"];
const WARM_KEY = "norte:warm";

function storage(): KV {
  return {
    getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  };
}

/** Avisa quando está sem sinal e envia sozinha, quando a internet volta, o que foi registrado no aparelho. */
export function OfflineSync() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => setItems(readOutbox(storage())), []);

  const send = useCallback(async (item: OutboxItem) => {
    const payload = { ...item.payload } as unknown as OsInput;
    if (item.newClientName) {
      const c = await ensureClient(item.newClientName);
      if (!c.ok || !c.data) return { ok: false as const, error: c.ok ? "Não foi possível cadastrar o cliente." : c.error };
      payload.client_id = c.data.id;
    }
    const res = await saveOS({ ...payload, new_id: item.key });
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || readOutbox(storage()).filter((i) => !i.error).length === 0) return;
    setSyncing(true);
    try {
      const r = await flushOutbox(storage(), send);
      if (r.sent > 0) {
        setToast(r.sent === 1 ? "1 OS enviada." : `${r.sent} OS enviadas.`);
        setTimeout(() => setToast(null), 5000);
        router.refresh();
      }
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh, router, send]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const on = () => { setOnline(true); void sync(); };
    const off = () => setOnline(false);
    const changed = () => { refresh(); void sync(); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("norte:outbox", changed);
    window.addEventListener("storage", refresh);
    void sync();
    const timer = setInterval(() => { if (readOutbox(storage()).some((i) => !i.error)) void sync(); }, 30000);
    return () => {
      window.removeEventListener("online", on); window.removeEventListener("offline", off);
      window.removeEventListener("norte:outbox", changed); window.removeEventListener("storage", refresh);
      clearInterval(timer);
    };
  }, [refresh, sync]);

  // Com sinal, deixa as páginas de campo guardadas no aparelho (a cada 6 horas).
  useEffect(() => {
    if (!navigator.onLine || !("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    const kv = storage();
    if (Date.now() - Number(kv.getItem(WARM_KEY) ?? 0) < 6 * 3600 * 1000) return;
    kv.setItem(WARM_KEY, String(Date.now()));
    for (const url of WARM_PAGES) fetch(url, { credentials: "include", headers: { Accept: "text/html" } }).catch(() => { /* tenta na próxima vez */ });
  }, []);

  const pending = items.filter((i) => !i.error);
  const failed = items.filter((i) => i.error);
  if (online && items.length === 0 && !toast) return null;

  const stuck = pending.some((i) => i.attempts >= 3);
  const tone = !online ? "bg-brand-amber text-brand-dark" : failed.length ? "bg-danger text-white" : toast && pending.length === 0 ? "bg-brand-green text-white" : "bg-brand-dark text-white";

  return (
    <div role="status" aria-live="polite" className={`fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl p-3 text-sm shadow-lg md:bottom-4 md:left-72 md:right-6 print:hidden ${tone}`}>
      <div className="flex items-center gap-3">
        {!online ? <CloudOff className="size-5 shrink-0" aria-hidden /> : <UploadCloud className="size-5 shrink-0" aria-hidden />}
        <p className="min-w-0 flex-1 font-semibold leading-snug">
          {!online && "Sem sinal. O que você registrar fica salvo no aparelho e vai sozinho quando o sinal voltar."}
          {online && toast && pending.length === 0 && toast}
          {online && pending.length > 0 && `${pending.length} OS aguardando envio.`}
          {online && pending.length === 0 && failed.length > 0 && !toast && "Uma OS não foi aceita. Veja abaixo."}
        </p>
        {online && pending.length > 0 && (
          <button type="button" disabled={syncing} onClick={() => void sync()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 font-bold hover:bg-white/30 disabled:opacity-60">
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} aria-hidden /> {syncing ? "Enviando…" : "Enviar agora"}
          </button>
        )}
      </div>
      {!online && pending.length > 0 && <p className="mt-1 pl-8 text-xs font-medium opacity-90">{pending.length} OS guardada(s) neste aparelho.</p>}
      {stuck && online && <p className="mt-1 pl-8 text-xs font-medium opacity-90">Se não enviar, saia e entre no sistema de novo (login) e toque em “Enviar agora”.</p>}
      {items.length > 0 && (
        <details className="mt-2 pl-8">
          <summary className="cursor-pointer text-xs font-bold underline">Ver {items.length === 1 ? "a OS guardada" : "as OS guardadas"}</summary>
          <ul className="mt-2 space-y-1.5">
            {items.map((i) => (
              <li key={i.key} className="rounded-lg bg-black/15 p-2 text-xs">
                <p className="font-bold">{i.label}</p>
                {i.error && <p className="mt-0.5">Recusada: {i.error}</p>}
                <div className="mt-1 flex gap-3 font-bold">
                  {i.error && <button type="button" className="underline" onClick={() => { retryItem(storage(), i.key); refresh(); void sync(); }}>Tentar de novo</button>}
                  <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => { if (confirm("Descartar esta OS guardada no aparelho? Ela não será enviada.")) { removeFromOutbox(storage(), i.key); refresh(); } }}><X className="size-3" aria-hidden /> Descartar</button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { btn } from "./ui";

type Deferred = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const LS_KEY = "norte:install:dismissed";

/** Convite para instalar o app: passo a passo no iPhone (não tem botão automático) e botão no Android. */
export function InstallApp() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [deferred, setDeferred] = useState<Deferred | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem(LS_KEY)) return; } catch { /* segue */ }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) { setMode("ios"); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as Deferred); setMode("android"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;
  const dismiss = () => { try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignora */ } setMode(null); };

  return (
    <div className="mb-4 rounded-2xl border border-brand-green/30 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <p className="font-extrabold text-brand-dark">Instale o app no seu celular</p>
        <button type="button" onClick={dismiss} aria-label="Fechar" className="rounded-lg p-1 text-brand-graphite/60 hover:bg-black/[0.05]"><X className="size-5" aria-hidden /></button>
      </div>
      {mode === "ios" ? (
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Abra este endereço no <strong>Safari</strong>.</li>
          <li>Toque em <strong>Compartilhar</strong> <Share className="inline size-4 align-text-bottom" aria-hidden /> (o quadrado com a seta para cima).</li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.</li>
        </ol>
      ) : (
        <p className="mt-2 text-sm text-brand-graphite/80">Abre em tela cheia e funciona também sem sinal.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "android" && deferred && (
          <button type="button" className={btn.primary} onClick={async () => { await deferred.prompt(); const c = await deferred.userChoice; if (c.outcome === "accepted") dismiss(); }}><Download className="size-5" aria-hidden /> Instalar app</button>
        )}
        <button type="button" className={btn.ghost} onClick={dismiss}>Agora não</button>
      </div>
    </div>
  );
}

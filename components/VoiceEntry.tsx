"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, Type } from "lucide-react";
import { parseSpokenEntry } from "@/lib/text-parse";
import { todayBR } from "@/lib/format";
import type { ScanResult } from "@/lib/receipt-scan";
import { btn, labelClass } from "./ui";

// Ditado do navegador (Chrome, Edge, Safari). Os tipos não vêm no TypeScript padrão.
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecCtor = new () => SpeechRec;
const getRecognition = (): SpeechRecCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "O microfone está bloqueado. Libere o microfone para este site nas permissões do navegador.",
  "service-not-allowed": "O navegador não deixou usar o ditado. Digite o texto ou use o microfone do teclado do celular.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale perto do aparelho.",
  "audio-capture": "Não encontrei um microfone neste aparelho.",
  network: "O ditado precisa de internet. Tente de novo ou digite o texto.",
};

/**
 * Descreva o lançamento falando ou digitando ("paguei 150 reais de diesel no posto Ipiranga ontem")
 * e o formulário é preenchido. Não usa IA nem chave: o texto é interpretado aqui mesmo.
 */
export function VoiceEntry({
  onParsed,
  placeholder = "Ex.: paguei 150 reais de diesel no posto Ipiranga ontem",
}: {
  onParsed: (data: ScanResult) => string; // devolve o aviso ("Preenchi valor, data…")
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recRef.current?.stop();
  }, []);

  function fill(value: string) {
    const r = parseSpokenEntry(value, todayBR());
    if (r.amount === null && !r.category && !r.date && !r.tipo) {
      setNote({ kind: "warn", text: "Não entendi valor nem categoria. Diga algo como “paguei 150 reais de diesel”." });
      return;
    }
    const msg = onParsed({
      tipo: r.tipo,
      amount: r.amount,
      date: r.date,
      description: r.description,
      category: r.category,
      status: r.status,
    });
    setNote({ kind: "ok", text: msg });
  }

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return setSupported(false);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    baseRef.current = text ? text.trim() + " " : "";
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText(baseRef.current + spoken);
    };
    rec.onerror = (e) => {
      setNote({ kind: "warn", text: ERRORS[e.error] ?? `O ditado falhou (${e.error}). Digite o texto.` });
    };
    rec.onend = () => {
      setListening(false);
      setText((t) => {
        if (t.trim()) fill(t);
        return t;
      });
    };
    recRef.current = rec;
    setNote(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div>
      <span className={labelClass}>Falar ou digitar o lançamento</span>
      <div className="rounded-xl border border-black/10 bg-white p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={400}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-base focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {supported ? (
            <button
              type="button"
              onClick={toggle}
              aria-pressed={listening}
              className={`${listening ? "bg-danger text-white" : btn.cta} inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold`}
            >
              {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              {listening ? "Ouvindo… toque para parar" : "Falar"}
            </button>
          ) : (
            <span className="text-xs text-brand-graphite/60">Este navegador não tem ditado. Use o microfone do teclado do celular ou digite.</span>
          )}
          <button
            type="button"
            onClick={() => fill(text)}
            disabled={!text.trim()}
            className={`${btn.ghost} inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50`}
          >
            <Type className="size-4" aria-hidden /> Preencher pelo texto
          </button>
        </div>
      </div>
      {note && (
        <p
          role="status"
          className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${note.kind === "ok" ? "bg-brand-green/10 text-brand-dark" : "bg-brand-amber/15 text-[#7a4a00]"}`}
        >
          {note.kind === "ok" && <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />}
          {note.text}
        </p>
      )}
      <p className="mt-1.5 text-xs text-brand-graphite/60">
        Diga o que foi, o valor e onde: “recebi três mil e quinhentos reais da Fazenda Boa Vista”. Sem IA e sem custo; o texto é interpretado aqui.
      </p>
    </div>
  );
}

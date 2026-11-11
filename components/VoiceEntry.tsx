"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, Mic, MicOff, Sparkles, Type } from "lucide-react";
import { parseSpokenEntry } from "@/lib/text-parse";
import { matchByName, removeNamed, type Named } from "@/lib/voice-match";
import { formatBRL } from "@/lib/format";
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
  accounts = [],
  suppliers = [],
  placeholder = "Ex.: paguei 150 reais de diesel no posto Ipiranga ontem, pela conta do Nubank",
}: {
  onParsed: (data: ScanResult) => string; // devolve o aviso ("Preenchi valor, data…")
  accounts?: Named[]; // para reconhecer "pelo Nubank", "conta do Mateus"
  suppliers?: Named[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");
  const textRef = useRef(""); // texto mais recente (o ditado termina fora do ciclo de renderização)

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recRef.current?.stop();
  }, []);

  /** Interpreta a fala e preenche o formulário. Devolve o texto do aviso (o que foi entendido e o que faltou). */
  function interpret(value: string): { data: ScanResult; note: { kind: "ok" | "warn"; text: string } } | null {
    const r = parseSpokenEntry(value, todayBR());
    if (r.amount === null && !r.category && !r.date && !r.tipo) return null;
    const acc = accounts.length ? matchByName(value, accounts) : null;
    const sup = suppliers.length && r.tipo !== "entrada" ? matchByName(value, suppliers, { minRatio: 0.6 }) : null;
    const description = removeNamed(removeNamed(r.description, acc?.words ?? []), sup?.words ?? []);
    const data: ScanResult = {
      tipo: r.tipo, amount: r.amount, date: r.date, description, category: r.category, status: r.status,
      account_id: acc?.item?.id ?? null, supplier_id: sup?.item?.id ?? null,
    };
    const msg = onParsed(data);
    const got: string[] = [];
    if (r.amount !== null) got.push(`valor ${formatBRL(r.amount)}`);
    if (acc?.item) got.push(`conta ${acc.item.name}`);
    if (sup?.item) got.push(`fornecedor ${sup.item.name}`);
    const missing: string[] = [];
    if (r.amount === null) missing.push("o valor (diga, por exemplo, “150 reais”)");
    if (accounts.length > 1 && !acc?.item) {
      missing.push(acc && acc.candidates.length > 1 ? `a conta (ficou entre ${acc.candidates.map((c) => c.name).join(" e ")})` : "a conta (diga “pelo Nubank”, “conta do Mateus”…)");
    }
    const text = `${msg}${got.length ? ` Entendi: ${got.join(", ")}.` : ""}${missing.length ? ` Faltou: ${missing.join("; ")}. Confira abaixo e complete.` : ""}`;
    return { data, note: { kind: missing.length ? "warn" : "ok", text } };
  }

  function fill(value: string) {
    const out = interpret(value);
    if (!out) {
      setNote({ kind: "warn", text: "Não entendi valor nem categoria. Diga algo como “paguei 150 reais de diesel pelo Nubank”." });
      return;
    }
    setNote(out.note);
  }

  /** Áudio recebido (ex.: do WhatsApp): transcreve no servidor e preenche pelo texto. */
  async function sendAudio(file: File | null) {
    if (!file) return;
    setNote(null);
    setTranscribing(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/gestao/audio-transcribe", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { text?: string; provider?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error ?? "Não consegui transcrever o áudio.");
      textRef.current = json.text;
      setText(json.text);
      const out = interpret(json.text);
      if (!out) setNote({ kind: "warn", text: `Ouvi: “${json.text}”. Não achei valor nem categoria; ajuste o texto e toque em “Preencher pelo texto”.` });
      else setNote({ kind: out.note.kind, text: `${out.note.text} (áudio transcrito por ${json.provider})` });
    } catch (e) {
      setNote({ kind: "warn", text: e instanceof Error ? e.message : "Não consegui transcrever o áudio." });
    } finally {
      setTranscribing(false);
    }
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
    baseRef.current = textRef.current ? textRef.current.trim() + " " : "";
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      textRef.current = baseRef.current + spoken;
      setText(textRef.current);
    };
    rec.onerror = (e) => {
      setNote({ kind: "warn", text: ERRORS[e.error] ?? `O ditado falhou (${e.error}). Digite o texto.` });
    };
    rec.onend = () => {
      setListening(false);
      if (textRef.current.trim()) fill(textRef.current);
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
          onChange={(e) => { textRef.current = e.target.value; setText(e.target.value); }}
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
          <label className={`${btn.ghost} inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${transcribing ? "pointer-events-none opacity-60" : ""}`}>
            <FileAudio className="size-4" aria-hidden /> {transcribing ? "Transcrevendo…" : "Enviar áudio"}
            <input
              type="file"
              accept="audio/*,.ogg,.opus,.m4a,.mp3,.wav,.aac"
              className="sr-only"
              onChange={(e) => {
                void sendAudio(e.target.files?.[0] ?? null);
                e.target.value = ""; // permite enviar o mesmo arquivo de novo
              }}
            />
          </label>
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
        Diga o que foi, o valor e onde: “recebi três mil e quinhentos reais da Fazenda Boa Vista”. O ditado e a leitura do texto não usam IA nem têm custo. “Enviar áudio” serve para áudio recebido (ex.: do WhatsApp) e usa uma chave de Groq, OpenAI ou Gemini.
      </p>
    </div>
  );
}

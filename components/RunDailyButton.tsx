"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { runDailyNow } from "@/app/gestao/sistema/saude/actions";
import { btn } from "./ui";

export function RunDailyButton() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" className={btn.ghost} disabled={pending} onClick={() => start(async () => {
        setMsg(null);
        const r = await runDailyNow();
        setMsg(r.ok ? { ok: true, text: `Rotina executada: ${r.data?.created ?? 0} recorrente(s) criado(s); ${r.data?.reminder}.` } : { ok: false, text: r.error });
      })}><Play className="size-5" aria-hidden /> {pending ? "Executando…" : "Executar a rotina diária agora"}</button>
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-brand-green" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";

export function BackupPanel() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function sendNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar o backup.");
      setMsg({ type: "ok", text: `Backup enviado para ${json.to} (${json.total} registros). Confira a caixa de entrada e o spam.` });
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-nd-green-dark">Backup por e-mail</h2>
        <p className="mt-2 text-sm text-nd-graphite/80">
          Toda <strong>segunda-feira, às 8h</strong>, o sistema envia para <strong>nortedronesto@gmail.com</strong> um e-mail
          com dois anexos: o backup completo dos dados (.json) e a planilha de lançamentos (.csv). As fotos de recibo ficam no
          Supabase e não vão no anexo.
        </p>
        <p className="mt-2 text-sm text-nd-graphite/80">
          Para conferir agora se está tudo certo, envie um backup de teste:
        </p>
        <button
          onClick={sendNow}
          disabled={busy}
          className="mt-3 rounded-full bg-nd-green-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Enviar backup agora"}
        </button>
        {msg && (
          <p
            role="status"
            className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
              msg.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>
    </div>
  );
}

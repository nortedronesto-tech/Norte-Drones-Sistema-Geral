"use client";

import { useCallback, useEffect, useState } from "react";
import { PROVIDER_LABEL, detectProvider, type AiProvider } from "@/lib/ai-routing";

type Provider = {
  id: AiProvider;
  label: string;
  keysUrl: string;
  free: string;
  configured: boolean;
  source: "admin" | "vercel" | null;
  hint: string | null;
  enabled: boolean;
  state: "ok" | "limit" | "invalid" | "error" | null;
  until: string | null;
  message: string | null;
  lastOkAt: string | null;
  model: string;
  defaultModel: string;
  isActive: boolean;
};
type Snapshot = {
  ai: { active: string | null; activeLabel: string | null; providers: Provider[]; lastUsed: { provider: string; at: string } | null };
  resend: { configured: boolean; source: "admin" | "vercel" | null; hint: string | null } | null;
};

const btnPrimary =
  "rounded-full bg-nd-green-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60";
const btnGhost =
  "rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-semibold text-nd-graphite hover:bg-black/5 disabled:opacity-40";
const inputCls =
  "w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-nd-green focus:outline-none focus:ring-2 focus:ring-nd-green/30";

/** Mesma detecção do servidor (código compartilhado), só para mostrar "Detectei: …" enquanto a pessoa cola. */
function detectLabel(raw: string): string | null {
  const d = detectProvider(raw);
  return d.ok ? PROVIDER_LABEL[d.provider] : null;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function StatusBadge({ p }: { p: Provider }) {
  const base = "rounded-full px-2.5 py-0.5 text-xs font-bold";
  if (!p.configured) return <span className={`${base} bg-black/5 text-nd-graphite/60`}>sem chave</span>;
  if (!p.enabled) return <span className={`${base} bg-black/5 text-nd-graphite/60`}>desativada</span>;
  if (p.state === "invalid") return <span className={`${base} bg-red-50 text-red-700`}>chave recusada</span>;
  if (p.state === "limit") {
    const resting = p.until && Date.parse(p.until) > Date.now();
    return (
      <span className={`${base} bg-amber-50 text-amber-800`}>
        {p.message ?? "sem crédito"}
        {resting ? ` — tenta de novo às ${hhmm(p.until!)}` : ""}
      </span>
    );
  }
  if (p.state === "error") return <span className={`${base} bg-amber-50 text-amber-800`}>{p.message ?? "com problema"}</span>;
  if (p.state === "ok") return <span className={`${base} bg-green-50 text-green-800`}>funcionando</span>;
  return <span className={`${base} bg-black/5 text-nd-graphite/70`}>ainda não testada</span>;
}

export function IntegrationsPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [manualProvider, setManualProvider] = useState<"" | AiProvider>("");
  const [resendKey, setResendKey] = useState("");
  const [models, setModels] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/integrations");
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setSnap(json);
      setModels(Object.fromEntries((json as Snapshot).ai.providers.map((p) => [p.id, p.model])));
    } else {
      setMsg({ type: "error", text: json.error ?? "Não foi possível carregar." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(key: string, method: string, body?: unknown, query = ""): Promise<{ message?: string; label?: string }> {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/integrations${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar.");
      return json;
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const act = async (key: string, fn: () => Promise<string>) => {
    try {
      setMsg({ type: "ok", text: await fn() });
      await load();
    } catch {
      await load();
    }
  };

  if (!snap) return <p className="mt-6 text-sm text-nd-graphite/60">Carregando…</p>;
  const { ai } = snap;
  const detected = detectLabel(paste);
  const order = ai.providers.map((p) => p.id);

  const configured = ai.providers.filter((p) => p.configured);
  const others = ai.providers.filter((p) => !p.configured);

  // sobe/desce entre as IAs que têm chave (troca de lugar com a vizinha na ordem completa)
  function move(id: AiProvider, dir: -1 | 1) {
    const ci = configured.findIndex((p) => p.id === id);
    const neighbor = configured[ci + dir];
    if (!neighbor) return;
    const next = [...order];
    const i = next.indexOf(id);
    const j = next.indexOf(neighbor.id);
    [next[i], next[j]] = [next[j], next[i]];
    void act("order", async () => {
      await call("order", "PATCH", { action: "order", order: next });
      return "Ordem atualizada.";
    });
  }

  return (
    <div className="mt-6 space-y-5">
      {msg && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-nd-green-dark">IA para ler os recibos (híbrida)</h2>
        <p className="mt-1 text-sm text-nd-graphite/75">
          Cadastre quantas IAs quiser (Gemini, Grok, Groq, OpenRouter, Mistral, Together, Fireworks, NVIDIA, DeepInfra, Hugging Face,
          Cohere, OpenAI e Claude). O sistema usa a <strong>primeira da lista que estiver com crédito</strong>; quando ela acabar
          (ou a chave falhar), passa sozinho para a próxima. As chaves ficam criptografadas e nunca aparecem inteiras.
        </p>

        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            ai.active ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {ai.active
            ? `Lendo os recibos agora com: ${ai.activeLabel}`
            : "Nenhuma IA disponível: cadastre uma chave abaixo. Enquanto isso, o preenchimento da nota é manual."}
          {ai.lastUsed && (
            <span className="ml-2 font-normal text-nd-graphite/60">
              (última leitura: {ai.providers.find((p) => p.id === ai.lastUsed!.provider)?.label ?? ai.lastUsed.provider}, {hhmm(ai.lastUsed.at)})
            </span>
          )}
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act("add", async () => {
              const r = await call("add", "PUT", { value: paste, provider: detected ? undefined : manualProvider || undefined });
              setPaste("");
              setManualProvider("");
              return r.message ? `Chave do ${r.label} salva. ${r.message}` : `Chave do ${r.label} salva. Já está valendo.`;
            });
          }}
        >
          <label className="mb-1.5 block text-sm font-semibold">Colar uma chave de IA</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cole aqui (Gemini, Grok, Groq ou OpenAI)"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              className={inputCls}
            />
            <button className={btnPrimary} disabled={!paste.trim() || (!detected && !manualProvider) || busy === "add"}>
              {busy === "add" ? "Salvando e testando…" : "Salvar chave"}
            </button>
          </div>
          {paste.trim() && !detected ? (
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Não reconheci o formato dessa chave. De qual IA ela é?</p>
              <select className={`${inputCls} mt-2`} value={manualProvider} onChange={(e) => setManualProvider(e.target.value as AiProvider | "")}>
                <option value="">Escolha a IA…</option>
                {ai.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs">Depois de salvar, o sistema testa a chave e avisa se a IA recusou.</p>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-nd-graphite/60">
              {paste.trim()
                ? `Detectei: ${detected}. Ao salvar, o sistema já testa a chave.`
                : "O sistema descobre sozinho de qual IA é pelo começo da chave (AIza… ou AQ.… = Gemini, xai-… = Grok, gsk_… = Groq, sk-ant-… = Claude, sk-or-… = OpenRouter, sk-… = OpenAI…). Se não reconhecer, você escolhe."}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-nd-green-dark">Ordem de uso</h2>
        <p className="mt-1 text-sm text-nd-graphite/70">De cima para baixo. Use ▲ ▼ para mudar a ordem.</p>
        {configured.length === 0 && (
          <p className="mt-3 rounded-xl bg-black/[0.04] px-4 py-3 text-sm text-nd-graphite/70">
            Nenhuma IA com chave ainda. Cole uma chave acima ou veja a lista de IAs compatíveis mais abaixo.
          </p>
        )}
        <ul className="mt-3 divide-y divide-black/[0.06]">
          {configured.map((p, i) => (
            <li key={p.id} className={`py-4 ${p.isActive ? "rounded-xl bg-green-50/60 px-3" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="grid size-6 place-items-center rounded-full bg-nd-green-dark text-xs font-bold text-white">{i + 1}</span>
                <p className="font-semibold">{p.label}</p>
                {p.isActive && <span className="rounded-full bg-nd-green-dark px-2.5 py-0.5 text-xs font-bold text-white">em uso agora</span>}
                <StatusBadge p={p} />
              </div>
              <p className="mt-1 text-xs text-nd-graphite/60">
                {p.free}
                {p.configured && p.source === "admin" && p.hint ? ` · chave ${p.hint}` : ""}
                {p.configured && p.source === "vercel" ? " · chave vinda da Vercel" : ""}
                {p.lastOkAt ? ` · última leitura ok ${new Date(p.lastOkAt).toLocaleDateString("pt-BR")} ${hhmm(p.lastOkAt)}` : ""}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className={btnGhost} disabled={i === 0 || busy === "order"} onClick={() => move(p.id, -1)} aria-label={`Subir ${p.label}`}>
                  ▲
                </button>
                <button className={btnGhost} disabled={i === configured.length - 1 || busy === "order"} onClick={() => move(p.id, 1)} aria-label={`Descer ${p.label}`}>
                  ▼
                </button>
                <button
                  className={btnGhost}
                  disabled={!p.configured || busy === `test-${p.id}`}
                  onClick={() =>
                    act(`test-${p.id}`, async () => (await call(`test-${p.id}`, "POST", { provider: p.id })).message ?? "Chave funcionando.")
                  }
                >
                  {busy === `test-${p.id}` ? "Testando…" : "Testar"}
                </button>
                <button
                  className={btnGhost}
                  disabled={!p.configured || busy === `toggle-${p.id}`}
                  onClick={() =>
                    act(`toggle-${p.id}`, async () => {
                      await call(`toggle-${p.id}`, "PATCH", { action: "toggle", provider: p.id, enabled: !p.enabled });
                      return p.enabled ? `${p.label} desativada.` : `${p.label} ativada.`;
                    })
                  }
                >
                  {p.enabled ? "Desativar" : "Ativar"}
                </button>
                {p.source === "admin" && (
                  <button
                    className={`${btnGhost} text-red-700`}
                    disabled={busy === `del-${p.id}`}
                    onClick={() => {
                      if (!window.confirm(`Remover a chave do ${p.label}?`)) return;
                      void act(`del-${p.id}`, async () => {
                        await call(`del-${p.id}`, "DELETE", undefined, `?provider=${p.id}`);
                        return `Chave do ${p.label} removida.`;
                      });
                    }}
                  >
                    Remover
                  </button>
                )}
                <a href={p.keysUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-nd-green hover:underline">
                  Criar chave ↗
                </a>
              </div>

              <details className="mt-2 text-xs text-nd-graphite/70">
                <summary className="cursor-pointer font-semibold">Modelo (avançado)</summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputCls}
                    placeholder={p.defaultModel}
                    value={models[p.id] ?? ""}
                    onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                  <button
                    className={btnGhost}
                    disabled={busy === `model-${p.id}`}
                    onClick={() =>
                      act(`model-${p.id}`, async () => {
                        await call(`model-${p.id}`, "PATCH", { action: "model", provider: p.id, model: models[p.id] ?? "" });
                        return "Modelo salvo.";
                      })
                    }
                  >
                    Salvar modelo
                  </button>
                </div>
                <p className="mt-1">Deixe em branco para usar o padrão ({p.defaultModel}). Só mude se a IA aposentar o modelo.</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-nd-green-dark">Outras IAs compatíveis ({others.length})</h2>
        <p className="mt-1 text-sm text-nd-graphite/70">
          Todas leem imagem e funcionam como reserva. Crie uma chave no site da IA e cole no campo lá em cima: o sistema reconhece
          sozinho (ou pede para você escolher a IA).
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-nd-green">Ver as {others.length} IAs sem chave</summary>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {others.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-nd-graphite/60">{p.free}</p>
                </div>
                <a href={p.keysUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-nd-green hover:underline">
                  Criar chave ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-extrabold text-nd-green-dark">Resend (e-mail do backup)</h2>
          {snap.resend?.configured ? (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-800">
              configurada {snap.resend.source === "admin" ? `(${snap.resend.hint ?? ""})` : "(pela Vercel)"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">não configurada</span>
          )}
        </div>
        <p className="mt-1 text-sm text-nd-graphite/70">
          Envia o backup semanal por e-mail. Crie a conta no Resend com o mesmo e-mail que vai receber o backup.{" "}
          <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-nd-green hover:underline">
            Criar chave ↗
          </a>
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void act("resend", async () => {
              await call("resend", "PUT", { name: "RESEND_API_KEY", value: resendKey });
              setResendKey("");
              return "Chave do Resend salva. Teste em Backup → Enviar backup agora.";
            });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="re_…"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            className={inputCls}
          />
          <button className={btnPrimary} disabled={!resendKey.trim() || busy === "resend"}>
            {busy === "resend" ? "Salvando…" : "Salvar"}
          </button>
          {snap.resend?.source === "admin" && (
            <button
              type="button"
              className={`${btnGhost} text-red-700`}
              onClick={() => {
                if (!window.confirm("Remover a chave do Resend? O backup por e-mail para de funcionar.")) return;
                void act("resend-del", async () => {
                  await call("resend-del", "DELETE", undefined, "?name=RESEND_API_KEY");
                  return "Chave do Resend removida.";
                });
              }}
            >
              Remover
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

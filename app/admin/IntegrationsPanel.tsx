"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  name: "OPENAI_API_KEY" | "RESEND_API_KEY";
  configured: boolean;
  source: "admin" | "vercel" | null;
  hint: string | null;
  updatedAt: string | null;
};

const INFO: Record<Item["name"], { title: string; what: string; link: { href: string; label: string }; placeholder: string }> = {
  OPENAI_API_KEY: {
    title: "OpenAI",
    what: "Lê a foto da nota e preenche valor, data e categoria sozinho; também gera imagens por IA nos posts. Cada leitura custa uma fração de centavo.",
    link: { href: "https://platform.openai.com/api-keys", label: "Criar chave na OpenAI" },
    placeholder: "sk-…",
  },
  RESEND_API_KEY: {
    title: "Resend (e-mail do backup)",
    what: "Envia o backup semanal por e-mail. Crie a conta no Resend com o mesmo e-mail que vai receber o backup.",
    link: { href: "https://resend.com/api-keys", label: "Criar chave no Resend" },
    placeholder: "re_…",
  },
};

const btnPrimary =
  "rounded-full bg-nd-green-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60";
const btnGhost =
  "rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-nd-graphite hover:bg-black/5 disabled:opacity-50";

export function IntegrationsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { type: "ok" | "error"; text: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/integrations");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setItems(json.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const say = (name: string, type: "ok" | "error", text: string) => setMsg((m) => ({ ...m, [name]: { type, text } }));

  async function call(name: string, method: string, body?: unknown, query = "") {
    setBusy(name + method);
    try {
      const res = await fetch(`/api/admin/integrations${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar.");
      return json as { message?: string };
    } finally {
      setBusy(null);
    }
  }

  async function save(name: Item["name"]) {
    try {
      await call(name, "PUT", { name, value: values[name] ?? "" });
      setValues((v) => ({ ...v, [name]: "" }));
      say(name, "ok", "Chave salva com segurança. Já está valendo, sem precisar publicar de novo.");
      await load();
    } catch (e) {
      say(name, "error", (e as Error).message);
    }
  }

  async function test(name: Item["name"]) {
    try {
      const r = await call(name, "POST", { name });
      say(name, "ok", r.message ?? "Chave funcionando.");
    } catch (e) {
      say(name, "error", (e as Error).message);
    }
  }

  async function remove(name: Item["name"]) {
    if (!window.confirm("Remover esta chave? O recurso que depende dela para de funcionar até você cadastrar outra.")) return;
    try {
      await call(name, "DELETE", undefined, `?name=${name}`);
      say(name, "ok", "Chave removida.");
      await load();
    } catch (e) {
      say(name, "error", (e as Error).message);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-nd-graphite/60">Carregando…</p>;

  return (
    <div className="mt-6 space-y-5">
      <p className="rounded-2xl bg-white p-4 text-sm text-nd-graphite/80 shadow-sm">
        Cole aqui as chaves de serviços externos. Elas ficam <strong>criptografadas no banco</strong> e só o servidor as usa:
        o painel nunca mostra a chave inteira, só o final dela. Vale na hora, sem mexer na Vercel.
      </p>

      {(["OPENAI_API_KEY", "RESEND_API_KEY"] as const).map((name) => {
        const info = INFO[name];
        const it = items.find((i) => i.name === name);
        const m = msg[name];
        return (
          <section key={name} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-nd-green-dark">{info.title}</h2>
              {it?.configured ? (
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-800">
                  configurada {it.source === "admin" ? `(${it.hint ?? ""})` : "(pela Vercel)"}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">não configurada</span>
              )}
            </div>
            <p className="mt-1 text-sm text-nd-graphite/70">{info.what}</p>
            <a href={info.link.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-nd-green hover:underline">
              {info.link.label} ↗
            </a>

            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void save(name);
              }}
            >
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={it?.source === "admin" ? "Cole uma nova chave para trocar" : info.placeholder}
                value={values[name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-nd-green focus:outline-none focus:ring-2 focus:ring-nd-green/30"
              />
              <button className={btnPrimary} disabled={!values[name] || busy === name + "PUT"}>
                {busy === name + "PUT" ? "Salvando…" : "Salvar"}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {name === "OPENAI_API_KEY" && (
                <button className={btnGhost} disabled={!it?.configured || busy === name + "POST"} onClick={() => test(name)}>
                  {busy === name + "POST" ? "Testando…" : "Testar chave"}
                </button>
              )}
              {it?.source === "admin" && (
                <button className={`${btnGhost} text-red-700`} disabled={busy === name + "DELETE"} onClick={() => remove(name)}>
                  Remover
                </button>
              )}
            </div>

            {m && (
              <p
                role="status"
                className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${m.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
              >
                {m.text}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

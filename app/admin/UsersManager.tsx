"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "admin" | "socio" | "financeiro" | "consulta";
type UserRow = {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  last_sign_in_at: string | null;
};
type SemNivel = { user_id: string; email: string; last_sign_in_at: string | null };

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  socio: "Sócio",
  financeiro: "Financeiro",
  consulta: "Consulta",
};
const ROLE_HELP: Record<Role, string> = {
  admin: "Tudo, inclusive cadastrar usuários e níveis de acesso.",
  socio: "Gestão completa e admin do site, sem cadastrar usuários.",
  financeiro: "Lança e consulta o financeiro. Sem cadastros e sem admin do site.",
  consulta: "Só visualiza o financeiro. Não altera nada.",
};
const ROLES = Object.keys(ROLE_LABEL) as Role[];

const input =
  "w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-nd-green focus:outline-none focus:ring-2 focus:ring-nd-green/30";
const btnPrimary =
  "rounded-full bg-nd-green-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60";
const btnGhost =
  "rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-semibold text-nd-graphite hover:bg-black/5 disabled:opacity-50";

function fmtDate(iso: string | null) {
  if (!iso) return "nunca entrou";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [semNivel, setSemNivel] = useState<SemNivel[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "financeiro" as Role });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: json.error ?? "Não foi possível carregar os usuários." });
    } else {
      setUsers(json.users ?? []);
      setSemNivel(json.semNivel ?? []);
      setMe(json.me ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method: string, body?: unknown, query = "") {
    const res = await fetch(`/api/admin/users${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Erro ao salvar.");
  }

  async function run(key: string, fn: () => Promise<void>, okText: string) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ type: "ok", text: okText });
      await load();
    } catch (e) {
      setMsg({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    await run("add", async () => {
      await call("POST", form);
      setForm({ name: "", email: "", password: "", role: "financeiro" });
    }, "Usuário cadastrado. Ele já pode entrar com o e-mail e a senha informados.");
  }

  function resetPassword(u: { user_id: string; email: string }) {
    const pass = window.prompt(`Nova senha para ${u.email} (mínimo 8 caracteres):`);
    if (!pass) return;
    run(u.user_id, () => call("PATCH", { user_id: u.user_id, password: pass }), "Senha alterada.");
  }

  function remove(u: UserRow) {
    if (!window.confirm(`Excluir o acesso de ${u.name || u.email}? Essa pessoa não conseguirá mais entrar.`)) return;
    run(u.user_id, () => call("DELETE", undefined, `?user_id=${u.user_id}`), "Usuário excluído.");
  }

  if (loading) return <p className="mt-6 text-sm text-nd-graphite/60">Carregando usuários…</p>;

  return (
    <div className="mt-6 space-y-6">
      {msg && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            msg.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-nd-green-dark">Novo usuário</h2>
        <p className="mt-1 text-sm text-nd-graphite/70">
          Crie o login e escolha o que a pessoa pode acessar. Passe a senha para ela por um canal seguro.
        </p>
        <form onSubmit={addUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Nome" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input} type="email" placeholder="E-mail" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={input} type="text" placeholder="Senha (mín. 8 caracteres)" required minLength={8}
            autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <p className="text-xs text-nd-graphite/60 sm:col-span-2">{ROLE_HELP[form.role]}</p>
          <div className="sm:col-span-2">
            <button className={btnPrimary} disabled={busy === "add"}>
              {busy === "add" ? "Cadastrando…" : "Cadastrar usuário"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-nd-green-dark">Quem tem acesso</h2>
        <ul className="mt-3 divide-y divide-black/[0.06]">
          {users.map((u) => {
            const isMe = u.user_id === me;
            return (
              <li key={u.user_id} className="py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-semibold">{u.name || u.email}</p>
                  {isMe && <span className="rounded-full bg-nd-green/10 px-2 py-0.5 text-xs font-bold text-nd-green">você</span>}
                  {!u.active && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">desativado</span>}
                </div>
                <p className="text-sm text-nd-graphite/70">{u.email} · último acesso: {fmtDate(u.last_sign_in_at)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm"
                    value={u.role}
                    disabled={busy === u.user_id || isMe}
                    onChange={(e) =>
                      run(u.user_id, () => call("PATCH", { user_id: u.user_id, role: e.target.value }), "Nível atualizado.")
                    }
                    title={isMe ? "Você não pode mudar o seu próprio nível" : ROLE_HELP[u.role]}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button className={btnGhost} disabled={busy === u.user_id} onClick={() => resetPassword(u)}>
                    Trocar senha
                  </button>
                  {!isMe && (
                    <>
                      <button
                        className={btnGhost}
                        disabled={busy === u.user_id}
                        onClick={() =>
                          run(u.user_id, () => call("PATCH", { user_id: u.user_id, active: !u.active }),
                            u.active ? "Usuário desativado." : "Usuário reativado.")
                        }
                      >
                        {u.active ? "Desativar" : "Reativar"}
                      </button>
                      <button className={`${btnGhost} text-red-700`} disabled={busy === u.user_id} onClick={() => remove(u)}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {semNivel.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-extrabold text-amber-900">Logins sem nível definido</h2>
          <p className="mt-1 text-sm text-amber-900/80">
            Esses e-mails existem no Supabase, mas ainda não têm nível. Defina um para liberar (ou exclua).
          </p>
          <ul className="mt-3 space-y-2">
            {semNivel.map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{u.email}</span>
                <select
                  className="rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm"
                  defaultValue=""
                  disabled={busy === u.user_id}
                  onChange={(e) =>
                    e.target.value &&
                    run(u.user_id, () => call("PATCH", { user_id: u.user_id, role: e.target.value, name: u.email }), "Nível definido.")
                  }
                >
                  <option value="">Definir nível…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 text-sm text-nd-graphite/80 shadow-sm">
        <h2 className="text-base font-extrabold text-nd-green-dark">O que cada nível pode</h2>
        <ul className="mt-2 space-y-1">
          {ROLES.map((r) => (
            <li key={r}><strong>{ROLE_LABEL[r]}:</strong> {ROLE_HELP[r]}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

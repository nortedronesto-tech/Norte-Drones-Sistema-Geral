import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que a requisição vem de um sócio logado (e-mail ativo em `partners`).
 * Usada nas rotas /api/admin e no layout /admin — a proteção não depende só
 * de esconder a tela: o banco (RLS) também recusa quem não é sócio.
 */
export async function requirePartner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado." };
  const { data: isPartner } = await supabase.rpc("is_partner");
  if (!isPartner) return { ok: false as const, status: 403, error: "Acesso restrito aos sócios." };
  return { ok: true as const, supabase, user };
}

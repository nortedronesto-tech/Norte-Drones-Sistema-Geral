import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAccess, type Role } from "@/lib/access";

/**
 * Garante que a requisição vem de um usuário logado com um dos níveis permitidos.
 * Usada nas rotas /api/admin e nos layouts — a proteção não depende só de esconder
 * a tela: o banco (RLS) também recusa quem não tem permissão.
 */
export async function requireRole(allowed: Role[]) {
  const access = await getAccess();
  if (!access) return { ok: false as const, status: 401, error: "Não autenticado." };
  if (!access.role || !allowed.includes(access.role)) {
    return { ok: false as const, status: 403, error: "Seu nível de acesso não permite esta ação." };
  }
  const supabase = await createClient();
  return { ok: true as const, supabase, access, user: { id: access.userId, email: access.email } };
}

/** Admin do site: administrador ou sócio. */
export const requirePartner = () => requireRole(["admin", "socio"]);
/** Cadastro de usuários e backup manual: só administrador. */
export const requireAdmin = () => requireRole(["admin"]);

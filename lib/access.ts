import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "socio" | "financeiro" | "consulta";

export const ROLES: Role[] = ["admin", "socio", "financeiro", "consulta"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  socio: "Sócio",
  financeiro: "Financeiro",
  consulta: "Consulta",
};

export const ROLE_HELP: Record<Role, string> = {
  admin: "Tudo, inclusive cadastrar usuários e níveis de acesso.",
  socio: "Gestão completa e admin do site, sem cadastrar usuários.",
  financeiro: "Lança e consulta o financeiro. Sem cadastros e sem admin do site.",
  consulta: "Só visualiza o financeiro. Não altera nada.",
};

export type Access = {
  userId: string;
  email: string;
  name: string;
  role: Role | null;
  /** pode lançar/editar financeiro */
  canWrite: boolean;
  /** cadastros (sócios/contas) e admin do site */
  canManage: boolean;
  isAdmin: boolean;
};

/** Quem é o usuário logado e o que o nível dele permite (a RLS do banco também confere). */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleData } = await supabase.rpc("my_role");
  const role = (ROLES as string[]).includes(roleData as string) ? (roleData as Role) : null;

  let name = "";
  if (role) {
    const { data: own } = await supabase.from("user_access").select("name").eq("user_id", user.id).maybeSingle();
    name = own?.name?.trim() || "";
    if (!name) {
      const { data: partners } = await supabase.from("partners").select("name, email");
      name = partners?.find((p) => p.email?.toLowerCase() === user.email?.toLowerCase())?.name ?? "";
    }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    name: name || user.email || "",
    role,
    canWrite: role === "admin" || role === "socio" || role === "financeiro",
    canManage: role === "admin" || role === "socio",
    isAdmin: role === "admin",
  };
});

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: { error?: string; email?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha incorretos.", email };
  const next = String(formData.get("next") ?? "");
  // só aceita caminhos internos (evita redirecionamento para sites externos)
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/gestao");
}

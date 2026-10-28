import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Chaves que o administrador pode cadastrar em /admin → Integrações. */
export const SECRET_NAMES = ["OPENAI_API_KEY", "GEMINI_API_KEY", "XAI_API_KEY", "GROQ_API_KEY", "RESEND_API_KEY"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

const CACHE_MS = 60_000;
const cache = new Map<string, { value: string | null; until: number }>();

/**
 * Valor da chave: primeiro a cadastrada no /admin (cofre criptografado do Supabase),
 * depois a variável de ambiente da Vercel. Devolve null se não houver nenhuma.
 * Só roda no servidor — o navegador nunca recebe o valor.
 */
export async function getSecret(name: SecretName): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && hit.until > Date.now()) return hit.value ?? process.env[name] ?? null;

  let stored: string | null = null;
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin.rpc("get_app_secret", { p_name: name });
    if (!error && typeof data === "string" && data) stored = data;
  }
  cache.set(name, { value: stored, until: Date.now() + CACHE_MS });
  return stored ?? process.env[name] ?? null;
}

export type SecretStatus = {
  name: SecretName;
  configured: boolean;
  /** de onde vem: cadastrada no /admin ou na Vercel */
  source: "admin" | "vercel" | null;
  hint: string | null;
  updatedAt: string | null;
};

export async function secretStatus(): Promise<SecretStatus[]> {
  const admin = createAdminClient();
  const { data } = admin
    ? await admin.from("app_secret_meta").select("name, hint, updated_at")
    : { data: null };
  const meta = new Map((data ?? []).map((m) => [m.name as string, m]));
  return SECRET_NAMES.map((name) => {
    const m = meta.get(name);
    if (m) return { name, configured: true, source: "admin", hint: m.hint, updatedAt: m.updated_at };
    if (process.env[name]) return { name, configured: true, source: "vercel", hint: null, updatedAt: null };
    return { name, configured: false, source: null, hint: null, updatedAt: null };
  });
}

export async function saveSecret(name: SecretName, value: string, userId: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Falta a SUPABASE_SERVICE_ROLE_KEY na Vercel.");
  const hint = `…${value.slice(-4)}`;
  const { error } = await admin.rpc("set_app_secret", { p_name: name, p_value: value, p_hint: hint, p_user: userId });
  if (error) {
    if (/set_app_secret|function/i.test(error.message)) {
      throw new Error("O cofre de segredos ainda não existe no banco. Rode o script 0006_cofre_de_segredos.sql no Supabase.");
    }
    throw new Error(error.message);
  }
  cache.delete(name);
}

export async function removeSecret(name: SecretName) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Falta a SUPABASE_SERVICE_ROLE_KEY na Vercel.");
  const { error } = await admin.rpc("delete_app_secret", { p_name: name });
  if (error) throw new Error(error.message);
  cache.delete(name);
}

import { createClient } from "@supabase/supabase-js";

// Cliente sem sessão (chave anônima) para ler o que é público no site:
// contatos e imagens. A RLS só libera as chaves 'contacts' e 'images'.
// Timeout curto: se o Supabase não responder, o site cai nos valores padrão
// em vez de travar a página.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000), cache: "no-store" }),
    },
  });
}

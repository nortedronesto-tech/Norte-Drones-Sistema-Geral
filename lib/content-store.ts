import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import seed from "@/data/site-content.json";
import { createPublicClient } from "@/lib/supabase/public";

export type SiteContacts = {
  whatsappNumber: string; // apenas dígitos, com DDI+DDD, ex: 5563999999999
  whatsappMessage: string;
  phone: string;
  email: string;
  instagramHandle: string;
  instagramUrl: string;
  address: string;
  areaServed: string;
};

export type SiteContent = {
  contacts: SiteContacts;
};

const DEFAULT_CONTENT: SiteContent = seed as SiteContent;

// Os contatos do site ficam na tabela `site_settings` (chave 'contacts') do
// Supabase. Leitura pública (RLS libera só essa chave); escrita só por sócios.
// Sem Supabase configurado ou sem a linha, cai nos valores de data/site-content.json.
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return DEFAULT_CONTENT;
    const { data } = await supabase.from("site_settings").select("value").eq("key", "contacts").maybeSingle();
    if (data?.value && typeof data.value === "object") {
      return { contacts: { ...DEFAULT_CONTENT.contacts, ...(data.value as Partial<SiteContacts>) } };
    }
  } catch {
    /* usa o padrão */
  }
  return DEFAULT_CONTENT;
}

/** Salva com o cliente do usuário logado: a RLS só deixa passar sócios. */
export async function saveSiteContent(content: SiteContent, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "contacts", value: content.contacts, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export function buildWhatsAppLink(contacts: SiteContacts): string | null {
  if (!contacts.whatsappNumber) return null;
  const digits = contacts.whatsappNumber.replace(/\D/g, "");
  const text = encodeURIComponent(contacts.whatsappMessage || "");
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}

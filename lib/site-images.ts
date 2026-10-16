import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { SiteImageKey } from "@/lib/site-image-fields";

export type { SiteImageKey };

export const SITE_IMAGE_BUCKET = "site-images";

// Imagem padrão (arquivo em /public) usada até o primeiro upload pelo /admin.
export const SITE_IMAGES: Record<SiteImageKey, { fallback: string }> = {
  hero: { fallback: "/images/hero-drone-v2.jpg" },
  about: { fallback: "/images/about-operador.jpg" },
  logoLight: { fallback: "/brand/logo-horizontal-light.png" },
  logoDark: { fallback: "/brand/logo-horizontal-dark.png" },
};

/** URL pública de um arquivo do bucket `site-images`. */
export function siteImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${SITE_IMAGE_BUCKET}/${path}`;
}

// As imagens enviadas pelo /admin ficam no Supabase Storage (bucket público
// `site-images`); a tabela `site_settings` (chave 'images') guarda qual arquivo
// vale para cada posição. Cada upload gera um caminho novo, então não há cache velho.
export async function getSiteImages(): Promise<Record<SiteImageKey, string>> {
  const result = Object.fromEntries(
    Object.entries(SITE_IMAGES).map(([k, v]) => [k, v.fallback]),
  ) as Record<SiteImageKey, string>;
  try {
    const supabase = createPublicClient();
    if (!supabase) return result;
    const { data } = await supabase.from("site_settings").select("value").eq("key", "images").maybeSingle();
    const paths = (data?.value ?? {}) as Partial<Record<SiteImageKey, string>>;
    for (const key of Object.keys(SITE_IMAGES) as SiteImageKey[]) {
      if (typeof paths[key] === "string" && paths[key]) result[key] = siteImageUrl(paths[key]!);
    }
  } catch {
    /* usa as imagens padrão */
  }
  return result;
}

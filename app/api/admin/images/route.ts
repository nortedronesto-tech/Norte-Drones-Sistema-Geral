import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/admin-guard";
import { SITE_IMAGES, SITE_IMAGE_BUCKET, siteImageUrl, SiteImageKey } from "@/lib/site-images";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(request: NextRequest) {
  const guard = await requirePartner();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { supabase } = guard;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const key = formData.get("key");
  const file = formData.get("file");

  if (typeof key !== "string" || !(key in SITE_IMAGES)) {
    return NextResponse.json({ error: "Imagem não reconhecida." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 8MB)." }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use uma imagem JPG, PNG, WebP ou SVG." }, { status: 400 });
  }

  // Cada upload vira um arquivo novo (sem cache velho); o anterior é apagado depois.
  const path = `${key as SiteImageKey}/${Date.now()}.${ext}`;
  const upload = await supabase.storage
    .from(SITE_IMAGE_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "31536000" });
  if (upload.error) {
    return NextResponse.json({ error: "Não foi possível enviar a imagem. " + upload.error.message }, { status: 500 });
  }

  const { data: current } = await supabase.from("site_settings").select("value").eq("key", "images").maybeSingle();
  const paths = { ...((current?.value ?? {}) as Record<string, string>) };
  const previous = paths[key];
  paths[key] = path;

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "images", value: paths, updated_at: new Date().toISOString() });
  if (error) {
    await supabase.storage.from(SITE_IMAGE_BUCKET).remove([path]);
    return NextResponse.json({ error: "Não foi possível salvar. " + error.message }, { status: 500 });
  }
  if (previous && previous !== path) await supabase.storage.from(SITE_IMAGE_BUCKET).remove([previous]);

  return NextResponse.json({ ok: true, key, url: siteImageUrl(path) });
}

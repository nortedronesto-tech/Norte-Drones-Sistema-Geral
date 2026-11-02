import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/admin-guard";
import { runTranscription } from "@/lib/ai-providers";
import { PROVIDER_LABEL } from "@/lib/ai-routing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // limite de corpo das funções da Vercel é ~4,5 MB (um áudio de WhatsApp de 1 min tem ~0,5 MB)

// Transcreve um áudio (ex.: áudio de WhatsApp: "nota fiscal de 150 reais no posto Ipiranga").
// Só quem pode lançar (admin, sócio, financeiro).
export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin", "socio", "financeiro"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nenhum áudio enviado." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "O áudio está vazio." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Áudio grande demais (máximo 4 MB, cerca de 5 minutos). Mande um áudio mais curto." }, { status: 413 });
  }
  const mime = file.type && file.type.startsWith("audio/") ? file.type : file.type === "video/mp4" || file.type === "video/webm" ? file.type : "";
  if (!mime && !/\.(ogg|opus|oga|m4a|mp3|wav|webm|aac|flac|mp4|mpeg|mpga)$/i.test(file.name)) {
    return NextResponse.json({ error: "Esse arquivo não parece um áudio. Envie .ogg, .opus, .m4a, .mp3 ou .wav." }, { status: 400 });
  }

  const out = await runTranscription({
    bytes: await file.arrayBuffer(),
    mime: mime || "audio/ogg",
    name: file.name || "audio.ogg",
  });

  if ("value" in out) {
    return NextResponse.json({ ok: true, text: out.value, provider: PROVIDER_LABEL[out.provider] });
  }
  if (out.none) {
    return NextResponse.json(
      { error: "Para transcrever áudios, cadastre a chave da Groq (gratuita), da OpenAI ou do Gemini em Admin → Integrações. Enquanto isso, use o botão Falar ou digite o texto." },
      { status: 503 },
    );
  }
  const why = out.attempts.map((a) => `${PROVIDER_LABEL[a.provider]}: ${a.error.message}`).join(" · ");
  return NextResponse.json({ error: `Não consegui transcrever agora (${why}). Tente de novo ou digite o texto.` }, { status: 502 });
}

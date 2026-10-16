import { NextRequest, NextResponse } from "next/server";
import { generateAiImage, editAiImage, sizeForHeight } from "@/lib/ai-image";
import { requirePartner } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const guard = await requirePartner();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const prompt = formData.get("prompt");
  const mode = formData.get("mode");
  const heightRaw = formData.get("height");

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: "Descreva o que a IA deve gerar." },
      { status: 400 }
    );
  }
  if (mode !== "generate" && mode !== "edit") {
    return NextResponse.json({ error: "Modo inválido." }, { status: 400 });
  }

  const height = Number(heightRaw) || 1080;
  const size = sizeForHeight(height);

  try {
    let buffer: Buffer;

    if (mode === "edit") {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Envie a foto que a IA deve melhorar." },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Arquivo muito grande (máximo 8MB)." },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = await editAiImage({
        prompt: prompt.trim(),
        size,
        imageBuffer: Buffer.from(arrayBuffer),
        imageMimeType: file.type || "image/png",
      });
    } else {
      buffer = await generateAiImage({ prompt: prompt.trim(), size });
    }

    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
    return NextResponse.json({ ok: true, dataUrl });
  } catch (err) {
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem. " + (err as Error).message },
      { status: 500 }
    );
  }
}

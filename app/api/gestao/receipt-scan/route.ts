import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/admin-guard";
import { readReceipt, ReceiptAiError } from "@/lib/receipt-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_DATA_URL = 3_500_000; // ~2,6 MB de imagem (o navegador já reduz para ~300 KB)

// Lê a foto de uma nota/comprovante e devolve valor, data, descrição e categoria sugeridos.
// Só quem pode lançar (admin, sócio, financeiro) usa — e a foto só vai à OpenAI nesta chamada.
export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin", "socio", "financeiro"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await request.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof body?.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL) {
    return NextResponse.json({ error: "Foto muito grande para ler automaticamente." }, { status: 413 });
  }

  try {
    const data = await readReceipt(image);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof ReceiptAiError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Não foi possível ler a nota." }, { status: 500 });
  }
}

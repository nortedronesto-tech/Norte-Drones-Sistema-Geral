import "server-only";
import OpenAI from "openai";
import { getSecret } from "@/lib/app-secrets";

// Tamanhos suportados pelo modelo de imagem da OpenAI (gpt-image-1).
// Mapeamos o formato do post/vídeo (quadrado ou story) para o tamanho mais
// próximo disponível.
export function sizeForHeight(height: number): "1024x1024" | "1024x1536" {
  return height > 1200 ? "1024x1536" : "1024x1024";
}

async function client(): Promise<OpenAI> {
  const apiKey = await getSecret("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "A chave da OpenAI não está cadastrada. Cadastre em Admin → Integrações."
    );
  }
  return new OpenAI({ apiKey });
}

const STYLE_SUFFIX =
  "Fotografia realista, luz natural, sem texto, sem logotipos, sem marca d'água, sem pessoas com rosto identificável a menos que pedido.";

export async function generateAiImage(opts: {
  prompt: string;
  size: "1024x1024" | "1024x1536";
}): Promise<Buffer> {
  const openai = await client();
  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: `${opts.prompt}. ${STYLE_SUFFIX}`,
    size: opts.size,
    quality: "medium",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("A OpenAI não retornou nenhuma imagem.");
  return Buffer.from(b64, "base64");
}

export async function editAiImage(opts: {
  prompt: string;
  size: "1024x1024" | "1024x1536";
  imageBuffer: Buffer;
  imageMimeType: string;
}): Promise<Buffer> {
  const openai = await client();
  const file = await OpenAI.toFile(
    opts.imageBuffer,
    "input." + (opts.imageMimeType.split("/")[1] || "png"),
    { type: opts.imageMimeType }
  );
  const result = await openai.images.edit({
    model: "gpt-image-1",
    image: file,
    prompt: `${opts.prompt}. Mantenha o conteúdo original da foto (o drone e/ou a pessoa) reconhecível — apenas melhore ou ajuste conforme pedido. ${STYLE_SUFFIX}`,
    size: opts.size,
    quality: "medium",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("A OpenAI não retornou nenhuma imagem.");
  return Buffer.from(b64, "base64");
}

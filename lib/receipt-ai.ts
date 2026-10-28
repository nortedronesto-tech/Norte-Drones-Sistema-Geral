import "server-only";
import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";

const resultSchema = z.object({
  legible: z.boolean().optional(),
  tipo: z.enum(["saida", "entrada"]).nullable().optional(),
  amount: z.number().positive().max(99_999_999).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  merchant: z.string().max(120).nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
});

export type ReceiptReading = {
  tipo: "saida" | "entrada" | null;
  amount: number | null;
  date: string | null;
  description: string | null;
  category: string | null;
};

export class ReceiptAiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const SYSTEM = `Você lê fotos de comprovantes e notas de uma empresa brasileira de pulverização agrícola com drones (Norte Drones).
Tipos de documento: cupom/nota fiscal, recibo, comprovante de Pix/transferência, boleto, nota de abastecimento, fatura.
Devolva SOMENTE um JSON com as chaves:
- "legible": true se deu para ler o documento; false se a foto está ilegível ou não é um comprovante.
- "tipo": "saida" (dinheiro que a empresa pagou/gastou) ou "entrada" (dinheiro que a empresa recebeu); null se não der para saber. Cupom, nota de compra, boleto e comprovante de pagamento feito = "saida".
- "amount": o VALOR TOTAL pago ou recebido, em número com ponto decimal (ex.: 152.30). Use o total final (não o subtotal nem o troco nem o valor recebido em dinheiro). null se não achar.
- "date": data do documento no formato AAAA-MM-DD (datas brasileiras são DD/MM/AAAA). null se não achar.
- "merchant": nome do estabelecimento ou da pessoa/empresa (curto). null se não achar.
- "description": resumo curto do que foi (ex.: "Posto Ipiranga — diesel 38 L"). null se não souber.
- "category": uma destas categorias, a mais adequada, ou null:
  Saídas: ${EXPENSE_CATEGORIES.join(" | ")}
  Entradas: ${INCOME_CATEGORIES.join(" | ")}
Nunca invente valores: se não estiver visível, use null.`;

/** Lê uma foto de nota/comprovante com um modelo de visão da OpenAI. */
export async function readReceipt(dataUrl: string): Promise<ReceiptReading> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ReceiptAiError(
      "A leitura automática ainda não está ativa (falta a OPENAI_API_KEY na Vercel). Preencha os dados manualmente.",
      503,
    );
  }
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model,
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Leia este comprovante e responda só o JSON." },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new ReceiptAiError("A leitura demorou demais ou a conexão falhou. Tente de novo ou preencha manualmente.", 504);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const msg = body.error?.message ?? `erro ${res.status}`;
    if (res.status === 401) throw new ReceiptAiError("A chave da OpenAI (OPENAI_API_KEY) é inválida.", 502);
    if (res.status === 404 || /model/i.test(msg)) {
      throw new ReceiptAiError(`Modelo de leitura indisponível (${model}). Defina OPENAI_VISION_MODEL na Vercel.`, 502);
    }
    if (res.status === 429) throw new ReceiptAiError("Limite ou saldo da OpenAI esgotado. Preencha manualmente por enquanto.", 502);
    throw new ReceiptAiError(`Não foi possível ler a nota (${msg}).`, 502);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let raw: unknown;
  try {
    raw = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new ReceiptAiError("A resposta da leitura veio num formato inesperado. Tente de novo.", 502);
  }
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) throw new ReceiptAiError("A resposta da leitura veio num formato inesperado. Tente de novo.", 502);
  const v = parsed.data;
  if (v.legible === false) throw new ReceiptAiError("Não consegui ler essa foto. Tente de novo com mais luz e a nota inteira no quadro.", 422);

  const all: readonly string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const description = [v.merchant, v.description].filter(Boolean).join(" — ").slice(0, 200) || null;
  return {
    tipo: v.tipo ?? null,
    amount: v.amount ?? null,
    date: v.date ?? null,
    description: v.description && v.merchant && v.description.toLowerCase().includes(v.merchant.toLowerCase()) ? v.description : description,
    category: v.category && all.includes(v.category) ? v.category : null,
  };
}

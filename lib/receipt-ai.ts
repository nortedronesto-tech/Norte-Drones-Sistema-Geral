import "server-only";
import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { PROVIDER_LABEL, ProviderCallError, callVision, runHybrid, type AiProvider } from "@/lib/ai-providers";

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

function parseJsonLoose(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("sem JSON");
  return JSON.parse(text.slice(start, end + 1));
}

class UnreadableReceipt extends Error {}

/**
 * Lê uma foto de nota/comprovante com IA híbrida: usa a primeira IA disponível
 * (Gemini, Grok, Groq, OpenAI — na ordem escolhida em Admin → Integrações) e passa
 * para a próxima quando uma fica sem crédito, com chave inválida ou fora do ar.
 */
export async function readReceipt(dataUrl: string): Promise<ReceiptReading & { provider: AiProvider }> {
  const out = await runHybrid(
    async (p, key, model) => {
      const text = await callVision(p, key, model, SYSTEM, "Leia este comprovante e responda só o JSON.", dataUrl);
      let raw: unknown;
      try {
        raw = parseJsonLoose(text);
      } catch {
        throw new ProviderCallError("resposta em formato inesperado", "other", 200);
      }
      const parsed = resultSchema.safeParse(raw);
      if (!parsed.success) throw new ProviderCallError("resposta em formato inesperado", "other", 200);
      if (parsed.data.legible === false) throw new UnreadableReceipt();
      return parsed.data;
    },
    (e) => e instanceof UnreadableReceipt,
  ).catch((e) => {
    if (e instanceof UnreadableReceipt) {
      throw new ReceiptAiError("Não consegui ler essa foto. Tente de novo com mais luz e a nota inteira no quadro.", 422);
    }
    throw e;
  });

  if (!("value" in out)) {
    if (out.none) {
      throw new ReceiptAiError(
        "A leitura automática ainda não está ativa: cadastre uma chave de IA (Gemini, Grok, Groq ou OpenAI) em Admin → Integrações. Preencha manualmente por enquanto.",
        503,
      );
    }
    const friendly = (f: string, msg: string) =>
      f === "transient" ? "sobrecarregada ou sem resposta agora (é temporário, tente de novo em instantes)"
      : f === "credit" ? "sem crédito/cota"
      : f === "rate" ? "limite de uso atingido"
      : f === "invalid" ? "chave recusada"
      : f === "model" ? "modelo indisponível (ajuste em Admin → Integrações)"
      : msg;
    const why = out.attempts.map((a) => `${PROVIDER_LABEL[a.provider]}: ${friendly((a.error as { failure?: string }).failure ?? "other", a.error.message)}`).join(" · ");
    throw new ReceiptAiError(`Nenhuma IA conseguiu ler agora (${why}). Preencha manualmente ou veja Admin → Integrações.`, 502);
  }

  const v = out.value;
  const all: readonly string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const description = [v.merchant, v.description].filter(Boolean).join(" — ").slice(0, 200) || null;
  return {
    provider: out.provider,
    tipo: v.tipo ?? null,
    amount: v.amount ?? null,
    date: v.date ?? null,
    description: v.description && v.merchant && v.description.toLowerCase().includes(v.merchant.toLowerCase()) ? v.description : description,
    category: v.category && all.includes(v.category) ? v.category : null,
  };
}

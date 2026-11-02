"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const recipeSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome para a receita").max(120),
  crop: z.string().trim().max(80).optional(),
  target: z.string().trim().max(120).optional(),
  rate_l_ha: z.number().positive("Informe o volume de calda por hectare").max(1000),
  tank_l: z.number().positive("Informe o volume do tanque").max(10000),
  notes: z.string().trim().max(500).optional(),
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        dose: z.number().positive().max(100000),
        unit: z.enum(["L/ha", "mL/ha", "kg/ha", "g/ha"]),
        form: z.enum(["pre-diluir", "suspensao", "emulsao", "solucao", "adjuvante", "corretivo"]),
      }),
    )
    .max(20, "No máximo 20 produtos por receita"),
});

export type RecipeInput = z.input<typeof recipeSchema>;

export async function saveRecipe(input: RecipeInput): Promise<ActionResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("spray_recipes").insert({
    name: v.name,
    crop: v.crop || null,
    target: v.target || null,
    rate_l_ha: v.rate_l_ha,
    tank_l: v.tank_l,
    products: v.products,
    notes: v.notes || null,
  });
  if (error) {
    if (error.code === "42501") return fail("Seu nível de acesso não permite salvar receitas.");
    if (error.code === "42P01" || error.code === "PGRST205") return fail("Receitas salvas ainda não foram ativadas (falta rodar a migration 0007).");
    return fail(error.message);
  }
  revalidatePath("/gestao/campo");
  return { ok: true };
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Receita inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.from("spray_recipes").delete().eq("id", id).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Seu nível de acesso não permite apagar receitas.");
  revalidatePath("/gestao/campo");
  return { ok: true };
}

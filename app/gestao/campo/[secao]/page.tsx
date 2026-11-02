import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { CampoGuide, type SavedRecipe } from "@/components/CampoGuide";
import { SECOES, type Secao } from "@/lib/campo-content";

export const metadata = { title: "Campo" };

export default async function CampoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const atual = SECOES.find((s) => s.id === secao);
  if (!atual) notFound();

  const access = await getAccess();
  let recipes: SavedRecipe[] = [];
  let enabled = true;
  if (secao === "pulverizacao" || secao === "foliar") {
    const supabase = await createClient();
    // Se a migration 0007 ainda não foi rodada, a página continua funcionando (só sem receitas salvas).
    const { data, error } = await supabase
      .from("spray_recipes")
      .select("id, name, crop, target, rate_l_ha, tank_l, products, notes")
      .order("created_at", { ascending: false });
    enabled = !error;
    recipes = (data ?? []).map((r) => ({
      ...r,
      rate_l_ha: Number(r.rate_l_ha),
      tank_l: Number(r.tank_l),
      products: Array.isArray(r.products) ? r.products : [],
    }));
  }

  return (
    <>
      <PageHeader title={`Campo · ${atual.label}`} subtitle="Conta por tanque ou carga, passo a passo e tira-dúvidas." />
      <CampoGuide secao={secao as Secao} recipes={recipes} recipesEnabled={enabled} canWrite={access?.canOperate ?? false} canManage={access?.canManage ?? false} />
    </>
  );
}

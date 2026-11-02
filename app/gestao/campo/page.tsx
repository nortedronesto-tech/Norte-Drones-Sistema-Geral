import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { CampoGuide, type SavedRecipe } from "@/components/CampoGuide";

export const metadata = { title: "Guia de campo" };

export default async function CampoPage() {
  const access = await getAccess();
  const supabase = await createClient();
  // Se a migration 0007 ainda não foi rodada, a página continua funcionando (só sem receitas salvas).
  const { data, error } = await supabase
    .from("spray_recipes")
    .select("id, name, crop, target, rate_l_ha, tank_l, products, notes")
    .order("created_at", { ascending: false });
  const recipes: SavedRecipe[] = (data ?? []).map((r) => ({
    ...r,
    rate_l_ha: Number(r.rate_l_ha),
    tank_l: Number(r.tank_l),
    products: Array.isArray(r.products) ? r.products : [],
  }));

  return (
    <>
      <PageHeader title="Guia de campo" subtitle="Calda de pulverização: conta por tanque, passo a passo e tira-dúvidas." />
      <CampoGuide
        recipes={recipes}
        recipesEnabled={!error}
        canWrite={access?.canWrite ?? false}
        canManage={access?.canManage ?? false}
      />
    </>
  );
}

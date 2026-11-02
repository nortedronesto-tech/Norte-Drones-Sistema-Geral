import { notFound } from "next/navigation";
import AdminDashboard, { type TabKey } from "@/app/admin/AdminDashboard";
import { PageHeader } from "@/components/ui";
import { getSiteImages } from "@/lib/site-images";

export const dynamic = "force-dynamic";

const ABAS: Record<string, { tab: TabKey; title: string; subtitle: string }> = {
  contatos: { tab: "contatos", title: "Contatos do site", subtitle: "WhatsApp, telefone, e-mail e Instagram que aparecem no site público." },
  imagens: { tab: "imagens", title: "Imagens do site", subtitle: "Fotos e logos usadas no site público." },
  posts: { tab: "posts", title: "Gerador de posts", subtitle: "Crie posts para as redes sociais com a identidade da Norte." },
  video: { tab: "video", title: "Gerador de vídeo", subtitle: "Monte vídeos curtos para divulgação." },
};

export default async function MarketingPage({ params }: { params: Promise<{ aba: string }> }) {
  const { aba } = await params;
  const a = ABAS[aba];
  if (!a) notFound();
  const images = await getSiteImages();
  return (
    <>
      <PageHeader title={a.title} subtitle={a.subtitle} />
      <AdminDashboard siteImages={images} tab={a.tab} />
    </>
  );
}

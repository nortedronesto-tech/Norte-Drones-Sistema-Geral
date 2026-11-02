import { notFound } from "next/navigation";
import AdminDashboard, { type TabKey } from "@/app/admin/AdminDashboard";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const ABAS: Record<string, { tab: TabKey; title: string; subtitle: string }> = {
  usuarios: { tab: "usuarios", title: "Usuários e acessos", subtitle: "Quem entra no sistema e o que cada pessoa pode fazer." },
  integracoes: { tab: "integracoes", title: "Integrações", subtitle: "Chaves de IA (leitura de recibo e áudio) e e-mail de backup." },
  backup: { tab: "backup", title: "Backup", subtitle: "Cópia semanal por e-mail e backup manual." },
};

export default async function SistemaPage({ params }: { params: Promise<{ aba: string }> }) {
  const { aba } = await params;
  const a = ABAS[aba];
  if (!a) notFound();
  return (
    <>
      <PageHeader title={a.title} subtitle={a.subtitle} />
      <AdminDashboard siteImages={{} as never} isAdmin tab={a.tab} />
    </>
  );
}

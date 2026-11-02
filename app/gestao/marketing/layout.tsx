import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

// Marketing (site, imagens, posts, vídeo): administrador e sócio. O banco (RLS) também confere.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access?.canManage) redirect("/gestao");
  return (
    <>
      {/* O gerador de posts e o de vídeo desenham em <canvas> com estas fontes. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      {children}
    </>
  );
}

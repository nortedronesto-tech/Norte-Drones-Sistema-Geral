import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/gestao/actions";

export const metadata: Metadata = {
  title: "Painel administrativo",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // Só sócios ativos (e-mail em `partners`) entram; o banco também confere via RLS.
  const { data: isPartner } = await supabase.rpc("is_partner");
  if (!isPartner) {
    return (
      <main className="grid min-h-dvh place-items-center bg-nd-mist p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-nd-green-dark">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-nd-graphite/70">
            O e-mail <strong>{user.email}</strong> não está cadastrado como sócio ativo.
          </p>
          <form action={signOut} className="mt-5">
            <button className="rounded-xl bg-nd-green-dark px-5 py-3 font-bold text-white">Sair</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-nd-mist font-sans text-nd-graphite">
      {/* O gerador de posts desenha em <canvas> com estas fontes. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}

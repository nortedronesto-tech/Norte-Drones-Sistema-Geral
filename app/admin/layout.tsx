import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess } from "@/lib/access";
import { signOut } from "@/app/gestao/actions";
import { AdminTabs } from "@/components/AdminTabs";

export const metadata: Metadata = {
  title: "Painel administrativo",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access) redirect("/login?next=/admin");

  // Admin do site: administrador e sócio. O banco (RLS) também confere.
  if (!access.canManage) {
    return (
      <main className="grid min-h-dvh place-items-center bg-nd-mist p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-nd-green-dark">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-nd-graphite/70">
            O e-mail <strong>{access.email}</strong> não tem permissão para o painel administrativo.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {access.role && (
              <Link href="/gestao" className="rounded-xl bg-nd-green-dark px-5 py-3 font-bold text-white">
                Ir para a gestão
              </Link>
            )}
            <form action={signOut}>
              <button className="w-full rounded-xl border border-black/15 px-5 py-3 font-bold text-nd-graphite">Sair</button>
            </form>
          </div>
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
      <AdminTabs />
      {children}
    </div>
  );
}

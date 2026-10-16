import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { signOut } from "./actions";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Norte Drones · Gestão", template: "%s · Norte Drones" },
  description: "Sistema interno de gestão da Norte Drones.",
  applicationName: "Norte Gestão",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Norte Gestão", statusBarStyle: "default" },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gestao");

  // RLS só devolve sócios para quem é sócio; quem não é, enxerga zero linhas.
  const { data: partners } = await supabase.from("partners").select("name, email");
  const me = partners?.find((p) => p.email?.toLowerCase() === user.email?.toLowerCase());

  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center bg-brand-mist p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-brand-dark">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-brand-graphite/70">
            O e-mail <strong>{user.email}</strong> não está cadastrado como sócio ativo. Peça ao Helbert para
            incluir esse e-mail em Cadastros → Sócios.
          </p>
          <form action={signOut} className="mt-5">
            <button className="rounded-xl bg-brand-dark px-5 py-3 font-bold text-white">Sair</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-brand-mist text-brand-graphite">
      <Nav userName={me.name} email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:ml-64 md:max-w-none md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <ServiceWorkerRegister />
    </div>
  );
}

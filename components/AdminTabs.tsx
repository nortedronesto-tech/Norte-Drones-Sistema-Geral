"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

type Tab = { label: string; href: string; external?: boolean };

// Atalhos de todo o projeto, como abas, para navegar a partir do /admin.
const PAGES: Tab[] = [
  { label: "Admin", href: "/admin" },
  { label: "Gestão", href: "/gestao" },
  { label: "Lançamentos", href: "/gestao/lancamentos" },
  { label: "Despesa com foto", href: "/gestao/despesa-foto" },
  { label: "Reserva", href: "/gestao/reserva" },
  { label: "Cadastros", href: "/gestao/cadastros" },
  { label: "Site público", href: "/", external: true },
];

// Painéis externos (abrem em outra aba do navegador).
const TOOLS: Tab[] = [
  { label: "Vercel", href: "https://vercel.com/nortedronesto-tech/norte-drones-sistema-geral", external: true },
  { label: "GitHub", href: "https://github.com/nortedronesto-tech/Norte-Drones-Sistema-Geral", external: true },
  { label: "Supabase", href: "https://supabase.com/dashboard/project/zwwalcvfgvnvgsnnxukr", external: true },
];

const isActive = (path: string, href: string) =>
  href === "/admin" || href === "/gestao" ? path === href : path.startsWith(href);

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const base =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition";
  const style = active
    ? "bg-white text-nd-green-dark shadow-sm"
    : "text-white/80 hover:bg-white/10 hover:text-white";
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      {...(tab.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${base} ${style}`}
    >
      {tab.label}
      {tab.external && <ExternalLink className="size-3.5 opacity-70" aria-hidden />}
    </Link>
  );
}

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Links do projeto"
      className="sticky top-0 z-40 border-b border-white/10 bg-nd-green-dark text-white"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
        {PAGES.map((t) => (
          <TabLink key={t.label} tab={t} active={isActive(path, t.href)} />
        ))}
        <span className="mx-2 h-5 w-px shrink-0 bg-white/20" aria-hidden />
        {TOOLS.map((t) => (
          <TabLink key={t.label} tab={t} active={false} />
        ))}
      </div>
    </nav>
  );
}

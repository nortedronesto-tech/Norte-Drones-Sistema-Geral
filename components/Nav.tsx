"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Camera, ExternalLink, FileBarChart, House, LayoutGrid, ListChecks, LogOut, Sprout, X, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/gestao/actions";
import type { Role } from "@/lib/access";
import { MODULES, modulesFor, type ModuleItem } from "@/lib/modules";

type Item = ModuleItem;

const HOME: Item = { href: "/gestao", label: "Início", icon: House };
const matches = (path: string, href: string) => (href === "/gestao" ? path === "/gestao" : path === href || path.startsWith(`${href}/`));
// Só o item mais específico fica destacado (ex.: em /gestao/os/nova, "Nova OS" e não também "Ordens de serviço").
const ALL_HREFS = MODULES.flatMap((g) => g.items.filter((i) => !i.external).map((i) => i.href));
const isActive = (path: string, href: string) => {
  if (!matches(path, href)) return false;
  return !ALL_HREFS.some((h) => h.length > href.length && matches(path, h));
};

export function Nav({ userName, email, role }: { userName: string; email: string; role: Role }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const canWrite = role !== "consulta";
  const groups = modulesFor(role);

  useEffect(() => { setOpen(false); }, [path]);

  const link = (i: Item, tone: "dark" | "light") => {
    const active = isActive(path, i.href);
    const Icon = i.icon;
    const cls = tone === "dark"
      ? active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
      : active ? "bg-brand-green/10 text-brand-green" : "text-brand-graphite hover:bg-black/[0.04]";
    const common = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${cls}`;
    if (i.external) {
      return (
        <a key={i.href} href={i.href} target="_blank" rel="noopener noreferrer" className={common}>
          <Icon className="size-[18px] shrink-0" aria-hidden /> {i.label} <ExternalLink className="ml-auto size-3.5 opacity-50" aria-hidden />
        </a>
      );
    }
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={common}>
        <Icon className="size-[18px] shrink-0" aria-hidden /> {i.label}
      </Link>
    );
  };

  const menu = (tone: "dark" | "light") => (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {link(HOME, tone)}
      {groups.map((g) => (
        <div key={g.id} className="mt-3">
          <p className={`mb-1 flex items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-wider ${tone === "dark" ? "text-white/45" : "text-brand-graphite/50"}`}>
            <g.icon className="size-3.5" aria-hidden /> {g.label}
          </p>
          {g.items.map((i) => link(i, tone))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop: barra lateral com grupos */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto bg-brand-dark p-4 text-white md:flex print:hidden">
        <div className="mb-5 flex items-center gap-3 px-1">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-mist p-1.5">
            <Image src="/brand/n-mark.png" alt="" width={32} height={28} className="h-auto w-8" priority />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight">NORTE</p>
            <p className="text-[11px] font-medium tracking-[0.35em] text-white/70">GESTÃO</p>
          </div>
        </div>
        <div className="flex-1">{menu("dark")}</div>
        <div className="mt-4 border-t border-white/15 pt-4">
          <p className="truncate px-1 text-sm font-semibold">{userName}</p>
          <p className="truncate px-1 text-xs text-white/60">{email}</p>
          <form action={signOut}>
            <button className="mt-3 flex items-center gap-2 px-1 text-sm font-medium text-white/75 hover:text-white">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile: topo + barra inferior + gaveta com todos os grupos */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-dark px-4 py-3 text-white md:hidden print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-mist p-1">
            <Image src="/brand/n-mark.png" alt="" width={32} height={28} className="h-auto w-6" priority />
          </span>
          <span className="text-base font-extrabold tracking-tight">NORTE <span className="font-medium text-white/70">Gestão</span></span>
        </div>
        <form action={signOut}>
          <button aria-label="Sair" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><LogOut className="size-5" aria-hidden /></button>
        </form>
      </header>

      <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        <Tab href="/gestao" label="Início" icon={House} path={path} />
        <Tab href="/gestao/lancamentos" label="Lançar" icon={ListChecks} path={path} />
        {canWrite ? (
          <Link href="/gestao/despesa-foto" aria-label="Despesa com foto" className="relative flex justify-center">
            <span className="absolute -top-6 grid size-14 place-items-center rounded-full bg-brand-lime text-brand-dark shadow-lg ring-4 ring-brand-mist">
              <Camera className="size-6" aria-hidden />
            </span>
          </Link>
        ) : <Tab href="/gestao/relatorios" label="Relatórios" icon={FileBarChart} path={path} />}
        <Tab href="/gestao/campo/pulverizacao" label="Campo" icon={Sprout} path={path} match="/gestao/campo" />
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu completo"
          className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-brand-graphite/60">
          <LayoutGrid className="size-5" aria-hidden /> Menu
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-extrabold text-brand-dark">Menu</p>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-black/[0.05]"><X className="size-5" aria-hidden /></button>
            </div>
            {menu("light")}
            <p className="mt-5 truncate px-3 text-xs text-brand-graphite/60">{userName} · {email}</p>
          </div>
        </div>
      )}
      
    </>
  );
}

function Tab({ href, label, icon: Icon, path, match }: { href: string; label: string; icon: LucideIcon; path: string; match?: string }) {
  const active = isActive(path, match ?? href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${active ? "text-brand-green" : "text-brand-graphite/60"}`}>
      <Icon className="size-5" aria-hidden /> {label}
    </Link>
  );
}

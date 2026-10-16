"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Camera, Globe, House, ListChecks, LogOut, PiggyBank, Settings } from "lucide-react";
import { signOut } from "@/app/gestao/actions";

const items = [
  { href: "/gestao", label: "Início", icon: House },
  { href: "/gestao/lancamentos", label: "Lançamentos", icon: ListChecks },
  { href: "/gestao/despesa-foto", label: "Despesa com foto", icon: Camera, cta: true },
  { href: "/gestao/reserva", label: "Reserva", icon: PiggyBank },
  { href: "/gestao/cadastros", label: "Cadastros", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/gestao" ? path === "/gestao" : path.startsWith(href));

export function Nav({ userName, email }: { userName: string; email: string }) {
  const path = usePathname();

  return (
    <>
      {/* Desktop: barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-dark p-5 text-white md:flex">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-mist p-1.5">
            <Image src="/brand/n-mark.png" alt="" width={32} height={28} className="h-auto w-8" priority />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight">NORTE</p>
            <p className="text-[11px] font-medium tracking-[0.35em] text-white/70">GESTÃO</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon, cta }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  cta
                    ? "mt-2 bg-brand-lime text-brand-dark hover:brightness-95"
                    : active
                      ? "bg-white/15 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-5" aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/15 pt-4">
          <Link href="/admin" className="mb-3 flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white">
            <Globe className="size-4" aria-hidden /> Admin do site
          </Link>
          <p className="truncate text-sm font-semibold">{userName}</p>
          <p className="truncate text-xs text-white/60">{email}</p>
          <form action={signOut}>
            <button className="mt-3 flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile: topo + barra inferior */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-dark px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-mist p-1">
            <Image src="/brand/n-mark.png" alt="" width={32} height={28} className="h-auto w-6" priority />
          </span>
          <span className="text-base font-extrabold tracking-tight">NORTE <span className="font-medium text-white/70">Gestão</span></span>
        </div>
        <form action={signOut}>
          <button aria-label="Sair" className="rounded-lg p-2 text-white/80 hover:bg-white/10">
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </header>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map(({ href, label, icon: Icon, cta }) => {
          const active = isActive(path, href);
          if (cta) {
            return (
              <Link key={href} href={href} aria-label={label} className="relative flex justify-center">
                <span className="absolute -top-6 grid size-14 place-items-center rounded-full bg-brand-lime text-brand-dark shadow-lg ring-4 ring-brand-mist">
                  <Camera className="size-6" aria-hidden />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${active ? "text-brand-green" : "text-brand-graphite/60"}`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

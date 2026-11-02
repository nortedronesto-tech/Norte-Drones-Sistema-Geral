import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { modulesFor, type ModuleGroup, type ModuleItem } from "@/lib/modules";
import type { Role } from "@/lib/access";

const linkCls = "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-brand-graphite hover:bg-black/[0.04] md:py-1.5";

function ItemLink({ i }: { i: ModuleItem }) {
  return i.external ? (
    <a href={i.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
      <i.icon className="size-4 text-brand-graphite/50" aria-hidden /> {i.label} <ExternalLink className="ml-auto size-3 opacity-40" aria-hidden />
    </a>
  ) : (
    <Link href={i.href} className={linkCls}>
      <i.icon className="size-4 text-brand-graphite/50" aria-hidden /> {i.label}
    </Link>
  );
}

function Head({ g }: { g: ModuleGroup }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><g.icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-extrabold text-brand-dark">{g.label}</h2>
        <p className="text-xs leading-snug text-brand-graphite/60">{g.blurb}</p>
      </div>
    </div>
  );
}

/**
 * Tela inicial: um cartão por módulo. No celular os cartões vêm fechados (toque para abrir os atalhos),
 * para os números do negócio aparecerem logo; no computador ficam abertos. Mesma fonte do menu lateral.
 */
export function ModuleGrid({ role }: { role: Role }) {
  const groups = modulesFor(role).filter((g) => g.id !== "relatorios");
  const items = (g: ModuleGroup) => g.items.filter((i) => !i.external || g.id === "marketing").slice(0, 6);
  return (
    <section aria-label="Módulos" className="mb-5 grid gap-2.5 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
      {groups.map((g) => (
        <div key={g.id} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          {/* computador: sempre aberto */}
          <div className="hidden p-4 md:block">
            <Head g={g} />
            <ul className="mt-3 space-y-0.5 border-t border-black/[0.06] pt-2">
              {items(g).map((i) => <li key={i.href}><ItemLink i={i} /></li>)}
            </ul>
          </div>
          {/* celular: recolhido */}
          <details className="group md:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1"><Head g={g} /></div>
              <ChevronDown className="size-5 shrink-0 text-brand-graphite/50 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mx-3.5 mb-3 space-y-0.5 border-t border-black/[0.06] pt-2">
              {items(g).map((i) => <li key={i.href}><ItemLink i={i} /></li>)}
            </ul>
          </details>
        </div>
      ))}
    </section>
  );
}

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { modulesFor } from "@/lib/modules";
import type { Role } from "@/lib/access";

/** Tela inicial: um cartão por módulo, com atalhos para as páginas. Mesma fonte do menu lateral. */
export function ModuleGrid({ role }: { role: Role }) {
  const groups = modulesFor(role).filter((g) => g.id !== "relatorios");
  return (
    <section aria-label="Módulos" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {groups.map((g) => (
        <div key={g.id} className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><g.icon className="size-5" aria-hidden /></span>
            <div className="min-w-0">
              <h2 className="font-extrabold text-brand-dark">{g.label}</h2>
              <p className="text-xs leading-snug text-brand-graphite/60">{g.blurb}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-0.5 border-t border-black/[0.06] pt-2">
            {g.items.filter((i) => !i.external || g.id === "marketing").slice(0, 6).map((i) => (
              <li key={i.href}>
                {i.external ? (
                  <a href={i.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-graphite hover:bg-black/[0.04]">
                    <i.icon className="size-4 text-brand-graphite/50" aria-hidden /> {i.label} <ExternalLink className="ml-auto size-3 opacity-40" aria-hidden />
                  </a>
                ) : (
                  <Link href={i.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-graphite hover:bg-black/[0.04]">
                    <i.icon className="size-4 text-brand-graphite/50" aria-hidden /> {i.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

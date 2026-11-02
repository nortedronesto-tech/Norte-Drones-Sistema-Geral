// Fonte única do menu e da tela inicial: cada módulo (grupo) do sistema e suas páginas.
// Para criar uma área nova (ex.: Clientes, Frota), basta acrescentar um grupo aqui.
import {
  ArrowDownToLine, ArrowUpFromLine, BookOpen, Calculator, Camera, Database, ExternalLink, FileBarChart, FlaskConical,
  Globe, HelpCircle, Image as ImageIcon, KeyRound, Landmark, ListChecks, Megaphone, PiggyBank, Phone, Settings, Sprout,
  Users, Video, Wheat, Sparkles, type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/access";

export type Need = "write" | "manage" | "admin";
export type ModuleItem = { href: string; label: string; icon: LucideIcon; needs?: Need; external?: boolean };
export type ModuleGroup = { id: string; label: string; icon: LucideIcon; blurb: string; items: ModuleItem[] };

export const MODULES: ModuleGroup[] = [
  {
    id: "financeiro", label: "Financeiro", icon: Landmark, blurb: "Lançamentos, contas, conciliação e reserva.",
    items: [
      { href: "/gestao/lancamentos", label: "Lançamentos", icon: ListChecks },
      { href: "/gestao/despesa-foto", label: "Despesa com foto", icon: Camera, needs: "write" },
      { href: "/gestao/contas-a-pagar", label: "Contas a pagar", icon: ArrowUpFromLine },
      { href: "/gestao/contas-a-receber", label: "Contas a receber", icon: ArrowDownToLine },
      { href: "/gestao/conciliacao", label: "Conciliação bancária", icon: Landmark },
      { href: "/gestao/reserva", label: "Fundo de reserva", icon: PiggyBank },
    ],
  },
  {
    id: "campo", label: "Campo", icon: Sprout, blurb: "Calculadoras de calda e sólidos, passo a passo e dúvidas.",
    items: [
      { href: "/gestao/campo/pulverizacao", label: "Calculadora · Pulverização", icon: Calculator },
      { href: "/gestao/campo/foliar", label: "Calculadora · Foliar", icon: FlaskConical },
      { href: "/gestao/campo/solidos", label: "Calculadora · Sólidos", icon: Wheat },
      { href: "/gestao/campo/passo-a-passo", label: "Passo a passo da calda", icon: BookOpen },
      { href: "/gestao/campo/duvidas", label: "Tira-dúvidas", icon: HelpCircle },
    ],
  },
  {
    id: "marketing", label: "Marketing", icon: Megaphone, blurb: "Site público, contatos, imagens, posts e vídeos.",
    items: [
      { href: "/gestao/marketing/posts", label: "Gerador de posts", icon: Sparkles, needs: "manage" },
      { href: "/gestao/marketing/video", label: "Gerador de vídeo", icon: Video, needs: "manage" },
      { href: "/gestao/marketing/imagens", label: "Imagens do site", icon: ImageIcon, needs: "manage" },
      { href: "/gestao/marketing/contatos", label: "Contatos do site", icon: Phone, needs: "manage" },
      { href: "/", label: "Ver site público", icon: Globe, needs: "manage", external: true },
    ],
  },
  {
    id: "relatorios", label: "Relatórios", icon: FileBarChart, blurb: "Resultado do mês, planilha e PDF.",
    items: [{ href: "/gestao/relatorios", label: "Resultado mensal", icon: FileBarChart }],
  },
  {
    id: "sistema", label: "Sistema", icon: Settings, blurb: "Cadastros, usuários, integrações de IA e backup.",
    items: [
      { href: "/gestao/cadastros", label: "Cadastros", icon: Settings, needs: "manage" },
      { href: "/gestao/sistema/usuarios", label: "Usuários e acessos", icon: Users, needs: "admin" },
      { href: "/gestao/sistema/integracoes", label: "Integrações (IA e e-mail)", icon: KeyRound, needs: "admin" },
      { href: "/gestao/sistema/backup", label: "Backup", icon: Database, needs: "admin" },
      { href: "https://vercel.com/nortedronesto-tech/norte-drones-sistema-geral", label: "Vercel", icon: ExternalLink, needs: "admin", external: true },
      { href: "https://github.com/nortedronesto-tech/Norte-Drones-Sistema-Geral", label: "GitHub", icon: ExternalLink, needs: "admin", external: true },
      { href: "https://supabase.com/dashboard/project/zwwalcvfgvnvgsnnxukr", label: "Supabase", icon: ExternalLink, needs: "admin", external: true },
    ],
  },
];

export function allowed(item: ModuleItem, role: Role): boolean {
  if (item.needs === "write") return role !== "consulta";
  if (item.needs === "manage") return role === "admin" || role === "socio";
  if (item.needs === "admin") return role === "admin";
  return true;
}

/** Grupos com só as páginas que este nível de acesso pode abrir (grupo vazio some). */
export function modulesFor(role: Role): ModuleGroup[] {
  return MODULES.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i, role)) })).filter((g) => g.items.length > 0);
}

// Fonte única do menu e da tela inicial: cada módulo (grupo) do sistema e suas páginas.
// Para criar uma área nova (ex.: Clientes, Frota), basta acrescentar um grupo aqui.
import {
  ClipboardList, UserRound, ArrowDownToLine, ArrowUpFromLine, BookOpen, Calculator, Bug, Camera, HeartPulse, History, Repeat, ShieldCheck, Truck, Database, ExternalLink, FileBarChart, FlaskConical,
  Gauge, Globe, HelpCircle, Image as ImageIcon, KeyRound, Landmark, ListChecks, Megaphone, PiggyBank, Phone, Settings, Sprout,
  Users, Video, Wheat, Sparkles, type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/access";

export type Need = "write" | "manage" | "admin";
export type ModuleItem = { href: string; label: string; icon: LucideIcon; needs?: Need; external?: boolean; operador?: boolean };
export type ModuleGroup = { id: string; label: string; icon: LucideIcon; blurb: string; items: ModuleItem[] };

export const MODULES: ModuleGroup[] = [
  {
    id: "operacao", label: "Operação", icon: ClipboardList, blurb: "Ordens de serviço de aplicação e clientes, com cobrança automática.",
    items: [
      { href: "/gestao/os/nova", label: "Nova OS", icon: ClipboardList, needs: "write", operador: true },
      { href: "/gestao/os", label: "Ordens de serviço", icon: ListChecks, operador: true },
      { href: "/gestao/clientes", label: "Clientes", icon: UserRound },
    ],
  },
  {
    id: "financeiro", label: "Financeiro", icon: Landmark, blurb: "Lançamentos, fornecedores, contas, conciliação e reserva.",
    items: [
      { href: "/gestao/lancamentos", label: "Lançamentos", icon: ListChecks },
      { href: "/gestao/despesa-foto", label: "Despesa com foto", icon: Camera, needs: "write" },
      { href: "/gestao/contas-a-pagar", label: "Contas a pagar", icon: ArrowUpFromLine },
      { href: "/gestao/contas-a-receber", label: "Contas a receber", icon: ArrowDownToLine },
      { href: "/gestao/recorrentes", label: "Lançamentos recorrentes", icon: Repeat },
      { href: "/gestao/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/gestao/conciliacao", label: "Conciliação bancária", icon: Landmark },
      { href: "/gestao/reserva", label: "Fundo de reserva", icon: PiggyBank },
    ],
  },
  {
    id: "campo", label: "Campo", icon: Sprout, blurb: "Pré-voo (clima e checklist), calculadoras, pragas de pastagem, passo a passo e dúvidas.",
    items: [
      { href: "/gestao/campo/pre-voo", label: "Pré-voo (clima e checklist)", icon: ShieldCheck, operador: true },
      { href: "/gestao/campo/pulverizacao", label: "Calculadora · Pulverização", icon: Calculator, operador: true },
      { href: "/gestao/campo/foliar", label: "Calculadora · Foliar", icon: FlaskConical, operador: true },
      { href: "/gestao/campo/solidos", label: "Calculadora · Sólidos", icon: Wheat, operador: true },
      { href: "/gestao/campo/pragas", label: "Pragas de pastagem", icon: Bug, operador: true },
      { href: "/gestao/campo/passo-a-passo", label: "Passo a passo da calda", icon: BookOpen, operador: true },
      { href: "/gestao/campo/duvidas", label: "Tira-dúvidas", icon: HelpCircle, operador: true },
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
    id: "relatorios", label: "Relatórios", icon: FileBarChart, blurb: "Resultado do mês, planilha e PDF; custo por hectare e viabilidade.",
    items: [
      { href: "/gestao/relatorios", label: "Resultado mensal", icon: FileBarChart },
      { href: "/gestao/viabilidade", label: "Viabilidade do serviço", icon: Gauge },
    ],
  },
  {
    id: "sistema", label: "Sistema", icon: Settings, blurb: "Cadastros, usuários, integrações de IA e backup.",
    items: [
      { href: "/gestao/cadastros", label: "Cadastros", icon: Settings, needs: "manage" },
      { href: "/gestao/auditoria", label: "Trilha de auditoria", icon: History, needs: "manage" },
      { href: "/gestao/sistema/usuarios", label: "Usuários e acessos", icon: Users, needs: "admin" },
      { href: "/gestao/sistema/integracoes", label: "Integrações (IA e e-mail)", icon: KeyRound, needs: "admin" },
      { href: "/gestao/sistema/saude", label: "Saúde do sistema", icon: HeartPulse, needs: "admin" },
      { href: "/gestao/sistema/backup", label: "Backup", icon: Database, needs: "admin" },
      { href: "https://vercel.com/nortedronesto-tech/norte-drones-sistema-geral", label: "Vercel", icon: ExternalLink, needs: "admin", external: true },
      { href: "https://github.com/nortedronesto-tech/Norte-Drones-Sistema-Geral", label: "GitHub", icon: ExternalLink, needs: "admin", external: true },
      { href: "https://supabase.com/dashboard/project/zwwalcvfgvnvgsnnxukr", label: "Supabase", icon: ExternalLink, needs: "admin", external: true },
    ],
  },
];

export function allowed(item: ModuleItem, role: Role): boolean {
  if (role === "operador") return item.operador === true; // operador: só Operação (OS) e Campo
  if (item.needs === "write") return role !== "consulta";
  if (item.needs === "manage") return role === "admin" || role === "socio";
  if (item.needs === "admin") return role === "admin";
  return true;
}

/** Grupos com só as páginas que este nível de acesso pode abrir (grupo vazio some). */
export function modulesFor(role: Role): ModuleGroup[] {
  return MODULES.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i, role)) })).filter((g) => g.items.length > 0);
}

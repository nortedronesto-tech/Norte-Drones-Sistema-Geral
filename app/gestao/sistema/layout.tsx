import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

// Usuários, integrações e backup: só o administrador.
export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access?.isAdmin) redirect("/gestao");
  return <>{children}</>;
}

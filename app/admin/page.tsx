import { redirect } from "next/navigation";

// O painel antigo agora vive dentro da Gestão (Marketing e Sistema). Mantém links e favoritos antigos funcionando.
export default function AdminPage() {
  redirect("/gestao/marketing/contatos");
}

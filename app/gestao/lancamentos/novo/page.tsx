import { redirect } from "next/navigation";

// Unificado: abre a janela "Novo lançamento" dentro de Lançamentos.
export default function NewTransactionPage() {
  redirect("/gestao/lancamentos?novo=1");
}

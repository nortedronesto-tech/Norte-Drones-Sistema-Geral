import { redirect } from "next/navigation";

// Unificado: o lançamento por foto, voz ou manual agora é a janela "Novo lançamento" dentro de Lançamentos.
export default function PhotoExpensePage() {
  redirect("/gestao/lancamentos?novo=1");
}

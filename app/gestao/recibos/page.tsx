import { redirect } from "next/navigation";

// O arquivo de recibos saiu do menu: o anexo agora se vê no próprio lançamento (Lançamentos, Contas a pagar/receber).
// A rota fica só para links antigos e aparelhos com a versão anterior instalada.
export default function RecibosPage() {
  redirect("/gestao/lancamentos");
}

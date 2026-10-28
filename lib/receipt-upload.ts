import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";

/** Reduz a foto e envia ao bucket privado "receipts". Devolve o caminho salvo. */
export async function uploadReceipt(file: File, date: string): Promise<string> {
  const supabase = createClient();
  const { blob, ext, type } = await compressImage(file);
  const [y, m] = date.split("-");
  const path = `${y}/${m}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: type, upsert: false });
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  return path;
}

/** Apaga uma foto que ficou sem lançamento (ex.: o salvamento falhou). */
export async function removeReceipt(path: string) {
  await createClient().storage.from("receipts").remove([path]);
}

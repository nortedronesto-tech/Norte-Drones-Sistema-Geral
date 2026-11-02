"use client";

import { Printer } from "lucide-react";
import { btn } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" className={btn.ghost} onClick={() => window.print()}>
      <Printer className="size-5" aria-hidden /> Imprimir / salvar PDF
    </button>
  );
}

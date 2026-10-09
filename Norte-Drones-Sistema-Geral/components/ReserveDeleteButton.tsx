"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteReserveEntry } from "@/app/(app)/actions";

export function ReserveDeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      aria-label="Excluir registro"
      onClick={() => { if (confirm("Excluir este registro do extrato da reserva?")) start(async () => { await deleteReserveEntry(id); }); }}
      className="rounded-lg p-1.5 text-danger/70 hover:bg-danger/5 disabled:opacity-50"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

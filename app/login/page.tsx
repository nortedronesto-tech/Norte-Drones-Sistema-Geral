import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-dark p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <span className="grid size-20 place-items-center rounded-2xl bg-brand-mist p-3">
            <Image src="/brand/n-mark.png" alt="Norte Drones" width={64} height={56} className="h-auto w-14" priority />
          </span>
          <p className="mt-4 text-2xl font-extrabold tracking-tight">NORTE DRONES</p>
          <p className="text-xs font-medium tracking-[0.4em] text-white/70">GESTÃO</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-white/60">Acesso restrito aos sócios.</p>
      </div>
    </main>
  );
}

import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Página não encontrada", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-nd-green-dark p-6 text-center text-white">
      <div className="max-w-md">
        <Image
          src="/brand/logo-horizontal-dark.png"
          alt="Norte Drones"
          width={260}
          height={85}
          className="mx-auto h-16 w-auto"
          priority
        />
        <p className="mt-10 text-6xl font-extrabold tracking-tight text-nd-green-lime">404</p>
        <h1 className="mt-3 text-2xl font-extrabold">Página não encontrada</h1>
        <p className="mt-3 text-white/70">O endereço que você abriu não existe ou foi movido.</p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-nd-amber px-6 py-3 font-semibold text-nd-green-dark transition hover:brightness-95"
        >
          Voltar ao site
        </Link>
      </div>
    </main>
  );
}

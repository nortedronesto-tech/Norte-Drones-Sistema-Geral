import Image from "next/image";
import { Container } from "./Container";
import { WhatsAppButton } from "./WhatsAppButton";

export function Hero({
  whatsappLink,
  imageUrl,
}: {
  whatsappLink: string | null;
  imageUrl: string;
}) {
  return (
    <section id="topo" className="relative flex min-h-[92vh] items-center overflow-hidden bg-nd-green-dark">
      <Image
        src={imageUrl}
        unoptimized={imageUrl.startsWith("http")}
        alt="Drone agrícola da Norte Drones pulverizando lavoura ao entardecer"
        fill
        priority
        quality={90}
        sizes="100vw"
        className="object-cover object-top opacity-80"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(18, 63, 36,0.95) 10%, rgba(18, 63, 36,0.55) 55%, rgba(18, 63, 36,0.25) 100%)",
        }}
      />
      {/* Esconde a marca d'água da arte original (símbolo "N") que ocupa a
          metade inferior da foto-fonte, sem precisar recortar a imagem tão
          curto a ponto de forçar um zoom que borra a foto. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(18, 63, 36,0) 38%, rgba(18, 63, 36,0.9) 58%, rgba(18, 63, 36,1) 68%)",
        }}
      />

      <Container className="relative z-10 py-32 sm:py-40">
        <div className="max-w-xl animate-fadeUp">
          <p className="mb-4 inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-nd-green-lime backdrop-blur">
            Pulverização e aplicação agrícola de precisão
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
            Tecnologia aplicada ao campo.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/85 sm:text-xl">
            A Norte Drones leva precisão à pulverização agrícola no Tocantins —
            aplicação com drone, dose controlada e acompanhamento técnico do
            início ao fim.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <WhatsAppButton whatsappLink={whatsappLink} label="Solicitar orçamento" />
            <a
              href="#servicos"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/70 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-nd-green-dark"
            >
              Conhecer os serviços
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

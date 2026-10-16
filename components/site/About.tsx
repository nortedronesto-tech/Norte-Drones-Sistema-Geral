import Image from "next/image";
import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";

export function About({ imageUrl }: { imageUrl: string }) {
  return (
    <section id="sobre" className="bg-white py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="Sobre a Norte Drones"
              title="Precisão na aplicação, do planejamento ao retorno."
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-nd-graphite/85 sm:text-lg">
              <p>
                A Norte Drones nasceu para levar a aplicação agrícola de
                precisão até o produtor rural do Tocantins. Trabalhamos com
                pulverização por drone, combinando planejamento de voo,
                controle de dose e acompanhamento técnico da operação.
              </p>
              <p>
                O compromisso é com o resultado: aplicação uniforme, equipe
                presente do primeiro contato ao retorno sobre o serviço, e
                comunicação direta em cada etapa.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative aspect-[922/1600] w-full max-w-sm mx-auto overflow-hidden rounded-2xl shadow-card">
              <Image
                src={imageUrl}
                unoptimized={imageUrl.startsWith("http")}
                alt="Operador da Norte Drones com o drone agrícola em campo"
                fill
                quality={90}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-16"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 70%, rgba(255,255,255,0.65) 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

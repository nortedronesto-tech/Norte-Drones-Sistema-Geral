import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { getSiteContent } from "@/lib/content-store";

export async function ServiceArea() {
  const { contacts } = await getSiteContent();
  const area = contacts.areaServed || "Fale com a gente para confirmar a cobertura";

  return (
    <section id="atuacao" className="bg-nd-mist py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Onde atuamos"
              title="Área de atuação"
            />
            <p className="mt-6 text-lg font-semibold text-nd-green-dark">
              {area}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-nd-graphite/75">
              Atendemos produtores rurais nessa região e avaliamos pedidos de
              outras áreas mediante consulta. Fale com a gente para confirmar
              a cobertura na sua propriedade.
            </p>
          </div>
          <div className="flex h-64 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5 sm:h-80">
            <div className="text-center text-nd-graphite/50">
              <MapIcon />
              <p className="mt-3 text-sm">
                Mapa da área de atuação em breve
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 fill-nd-graphite/30">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

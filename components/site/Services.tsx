import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { services } from "@/lib/site-data";
import { WhatsAppButton } from "./WhatsAppButton";

export function Services({ whatsappLink }: { whatsappLink: string | null }) {
  return (
    <section id="servicos" className="bg-nd-mist py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="O que fazemos"
          title="Serviços"
          description="Aplicação agrícola com drone, para diferentes tipos de insumo."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.slug}
              className="flex flex-col rounded-2xl bg-white p-8 shadow-card ring-1 ring-black/5"
            >
              <ServiceIcon kind={service.icon} />
              <h3 className="mt-6 text-xl font-bold text-nd-green-dark">
                {service.name}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-nd-graphite/80">
                {service.description}
              </p>
              <p className="mt-4 border-t border-nd-graphite/10 pt-4 text-sm font-medium text-nd-green">
                {service.benefit}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <WhatsAppButton
            whatsappLink={whatsappLink}
            label="Solicitar orçamento"
          />
        </div>
      </Container>
    </section>
  );
}

const ICONS: Record<string, string> = {
  // Gotas de pulverização
  spray:
    "M12 2c-1.7 3-4 6.6-4 9.5A4 4 0 0 0 12 15.5a4 4 0 0 0 4-4C16 8.6 13.7 5 12 2zm6.5 9c-.9 1.6-2 3.4-2 4.9a2 2 0 1 0 4 0c0-1.5-1.1-3.3-2-4.9zM3 15.5c-.6 1-1.2 2.1-1.2 3a1.7 1.7 0 1 0 3.4 0c0-.9-.6-2-1.2-3z",
  // Grãos/partículas sólidas espalhadas
  solids:
    "M6 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm12 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4 14a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm7 1a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zm9 .5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.5 4a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm-9.5.3a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z",
  // Folha
  leaf:
    "M20 4c-8 0-14 5-14 12 0 2 .5 3.5 1.3 4.7L18 10l1.4 1.4L8.7 21.7C9.9 22.5 11.5 23 13.5 23 19.5 23 20 15 20 4z",
};

function ServiceIcon({ kind }: { kind: string }) {
  const path = ICONS[kind] ?? ICONS.spray;
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-nd-green-dark/10">
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-nd-green-dark">
        <path d={path} />
      </svg>
    </div>
  );
}

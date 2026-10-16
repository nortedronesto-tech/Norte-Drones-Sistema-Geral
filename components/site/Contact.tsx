import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { getSiteContent, buildWhatsAppLink } from "@/lib/content-store";
import { WhatsAppButton } from "./WhatsAppButton";

export async function Contact() {
  const { contacts } = await getSiteContent();
  const whatsappLink = buildWhatsAppLink(contacts);

  const items = [
    {
      label: "WhatsApp",
      value: contacts.whatsappNumber
        ? formatPhoneDisplay(contacts.whatsappNumber)
        : "A definir",
      href: whatsappLink,
    },
    {
      label: "Telefone",
      value: contacts.phone || "A definir",
      href: contacts.phone ? `tel:${contacts.phone.replace(/\D/g, "")}` : null,
    },
    {
      label: "E-mail",
      value: contacts.email || "A definir",
      href: contacts.email ? `mailto:${contacts.email}` : null,
    },
    {
      label: "Instagram",
      value: contacts.instagramHandle || "A definir",
      href: contacts.instagramUrl || null,
    },
    {
      label: "Endereço",
      value: contacts.address || "A definir",
      href: null,
    },
  ];

  return (
    <section id="contato" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Fale com a gente"
          title="Contato"
          description="Escolha o canal que preferir — respondemos o mais rápido possível."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-nd-mist p-6 ring-1 ring-black/5"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-nd-green">
                {item.label}
              </p>
              {item.href ? (
                <a
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="mt-2 block break-words text-base font-semibold text-nd-green-dark hover:underline"
                >
                  {item.value}
                </a>
              ) : (
                <p className="mt-2 break-words text-base font-semibold text-nd-graphite/70">
                  {item.value}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10">
          <WhatsAppButton whatsappLink={whatsappLink} />
        </div>
      </Container>
    </section>
  );
}

function formatPhoneDisplay(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 10) return clean;
  const country = clean.length > 11 ? clean.slice(0, clean.length - 11) : "";
  const rest = country ? clean.slice(country.length) : clean;
  const ddd = rest.slice(0, 2);
  const num = rest.slice(2);
  const mid = num.length === 9 ? num.slice(0, 5) : num.slice(0, 4);
  const end = num.length === 9 ? num.slice(5) : num.slice(4);
  return `${country ? `+${country} ` : ""}(${ddd}) ${mid}-${end}`;
}

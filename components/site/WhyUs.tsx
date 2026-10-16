import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { whyUs } from "@/lib/site-data";

export function WhyUs() {
  return (
    <section id="diferenciais" className="bg-nd-green-dark py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Por que Norte Drones"
          title="O que sustenta a nossa forma de trabalhar"
          light
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyUs.map((item, index) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
            >
              <span className="text-sm font-bold text-nd-green-lime">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-bold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { howItWorks } from "@/lib/site-data";

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Processo"
          title="Como funciona"
          align="center"
        />

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {howItWorks.map((item, index) => (
            <div key={item.step} className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-nd-green-dark text-lg font-extrabold text-white">
                {item.step}
              </div>
              {index < howItWorks.length - 1 && (
                <div
                  aria-hidden
                  className="absolute left-1/2 top-8 hidden h-px w-full -translate-x-0 bg-nd-graphite/15 lg:block"
                  style={{ left: "58%", width: "84%" }}
                />
              )}
              <h3 className="mt-5 text-base font-bold text-nd-green-dark">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-nd-graphite/75">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

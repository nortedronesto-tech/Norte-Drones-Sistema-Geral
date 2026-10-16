import { Container } from "./Container";
import { WhatsAppButton } from "./WhatsAppButton";

export function CtaSection({ whatsappLink }: { whatsappLink: string | null }) {
  return (
    <section className="bg-nd-green-dark py-20">
      <Container>
        <div className="flex flex-col items-center justify-between gap-8 rounded-3xl bg-gradient-to-r from-nd-green to-nd-green-dark p-10 text-center shadow-card sm:p-14 lg:flex-row lg:text-left">
          <div className="max-w-xl">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              Pronto para levar precisão à sua próxima aplicação?
            </h2>
            <p className="mt-3 text-white/80">
              Fale agora com a Norte Drones e solicite um orçamento para a sua
              lavoura.
            </p>
          </div>
          <WhatsAppButton whatsappLink={whatsappLink} label="Falar no WhatsApp agora" />
        </div>
      </Container>
    </section>
  );
}

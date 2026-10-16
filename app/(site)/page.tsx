import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { About } from "@/components/site/About";
import { Services } from "@/components/site/Services";
import { WhyUs } from "@/components/site/WhyUs";
import { HowItWorks } from "@/components/site/HowItWorks";
import { ServiceArea } from "@/components/site/ServiceArea";
import { CtaSection } from "@/components/site/CtaSection";
import { Contact } from "@/components/site/Contact";
import { Footer } from "@/components/site/Footer";
import { getSiteContent, buildWhatsAppLink } from "@/lib/content-store";
import { getSiteImages } from "@/lib/site-images";

// Renderizado dinamicamente para refletir imediatamente as alterações
// salvas no painel /admin (WhatsApp, telefone, e-mail, Instagram, imagens etc.).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { contacts } = await getSiteContent();
  const whatsappLink = buildWhatsAppLink(contacts);
  const images = await getSiteImages();

  return (
    <>
      <Header
        whatsappLink={whatsappLink}
        logoUrl={images.logoLight}
        logoUrlOnDark={images.logoDark}
      />
      <main>
        <Hero whatsappLink={whatsappLink} imageUrl={images.hero} />
        <About imageUrl={images.about} />
        <Services whatsappLink={whatsappLink} />
        <WhyUs />
        <HowItWorks />
        <ServiceArea />
        <CtaSection whatsappLink={whatsappLink} />
        <Contact />
      </main>
      <Footer logoUrl={images.logoDark} />
    </>
  );
}

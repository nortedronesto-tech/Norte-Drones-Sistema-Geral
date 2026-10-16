"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { WhatsAppButton } from "./WhatsAppButton";

const NAV_ITEMS = [
  { href: "#sobre", label: "Sobre" },
  { href: "#servicos", label: "Serviços" },
  { href: "#diferenciais", label: "Diferenciais" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#atuacao", label: "Área de atuação" },
  { href: "#contato", label: "Contato" },
];

export function Header({
  whatsappLink,
  logoUrl,
  logoUrlOnDark,
}: {
  whatsappLink: string | null;
  logoUrl: string;
  logoUrlOnDark: string;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-white/95 shadow-sm backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <div className="container-nd flex h-16 items-center justify-between sm:h-20">
        <a href="#topo" className="flex items-center gap-2">
          <Image
            src={scrolled ? logoUrl : logoUrlOnDark}
            unoptimized={(scrolled ? logoUrl : logoUrlOnDark).startsWith("http")}
            alt="Norte Drones"
            width={190}
            height={62}
            priority
            className="h-10 w-auto object-contain sm:h-12"
          />
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                scrolled
                  ? "text-nd-graphite hover:text-nd-green"
                  : "text-white/90 hover:text-white"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <WhatsAppButton whatsappLink={whatsappLink} label="Falar no WhatsApp" />
        </div>

        <button
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 w-10 items-center justify-center rounded-md lg:hidden ${
            scrolled ? "text-nd-green-dark" : "text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            {open ? (
              <path d="M6.4 19 5 17.6 10.6 12 5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4z" />
            ) : (
              <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto border-t border-black/5 bg-white sm:top-20 lg:hidden">
          <Container>
            <nav className="flex flex-col py-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-black/5 py-3 text-sm font-medium text-nd-graphite last:border-none"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-4">
                <WhatsAppButton
                  whatsappLink={whatsappLink}
                  label="Falar no WhatsApp"
                  className="w-full"
                />
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="container-nd">{children}</div>;
}

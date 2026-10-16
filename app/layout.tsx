import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nortedrones.com.br";

// Metadados do site público. As áreas internas (/gestao, /admin) sobrescrevem
// título e marcam noindex nos próprios layouts.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Norte Drones | Pulverização e Aplicação Agrícola de Precisão",
    template: "%s | Norte Drones",
  },
  description:
    "Norte Drones aplica tecnologia de precisão à pulverização agrícola no Tocantins: menos desperdício de insumo, mais uniformidade na lavoura. Solicite um orçamento.",
  keywords: [
    "drone agrícola",
    "pulverização com drone",
    "aplicação de precisão",
    "agricultura de precisão Tocantins",
    "Norte Drones",
    "Porto Nacional",
    "Palmas",
  ],
  openGraph: {
    title: "Norte Drones | Pulverização e Aplicação Agrícola de Precisão",
    description:
      "Tecnologia aplicada ao campo: pulverização e aplicação agrícola de precisão com drones no Tocantins.",
    url: siteUrl,
    siteName: "Norte Drones",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/images/og-cover.jpg", width: 1200, height: 667 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#123f24",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

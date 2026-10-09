import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Norte Drones · Gestão", template: "%s · Norte Drones" },
  description: "Sistema interno de gestão da Norte Drones.",
  applicationName: "Norte Gestão",
  robots: { index: false, follow: false }, // sistema interno
  appleWebApp: { capable: true, title: "Norte Gestão", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b3d2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

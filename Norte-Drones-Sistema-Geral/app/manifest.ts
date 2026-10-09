import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Norte Drones · Gestão",
    short_name: "Norte Gestão",
    description: "Financeiro, agenda e campo da Norte Drones.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7f7",
    theme_color: "#0b3d2e",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Despesa com foto", url: "/despesa-foto", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

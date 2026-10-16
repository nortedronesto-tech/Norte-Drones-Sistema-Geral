import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Norte Drones · Gestão",
    short_name: "Norte Gestão",
    description: "Financeiro, agenda e campo da Norte Drones.",
    start_url: "/gestao",
    scope: "/gestao",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f1e8",
    theme_color: "#123f24",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Despesa com foto", url: "/gestao/despesa-foto", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // O service worker precisa ser sempre revalidado; senão uma versão antiga fica presa no celular.
  async headers() {
    return [
      {
        // Cabeçalhos de segurança em todas as páginas (o sistema guarda dados financeiros).
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default config;

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // O service worker precisa ser sempre revalidado; senão uma versão antiga fica presa no celular.
  async headers() {
    return [
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

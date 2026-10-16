import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nortedrones.com.br";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/gestao", "/login", "/api/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

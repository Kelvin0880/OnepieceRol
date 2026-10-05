import type { MetadataRoute } from "next";

const siteUrl = "https://grand-line-rpg-qgkv.onrender.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/play/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

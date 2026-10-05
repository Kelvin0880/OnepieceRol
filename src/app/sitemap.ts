import type { MetadataRoute } from "next";

const siteUrl = "https://grand-line-rpg-qgkv.onrender.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/news`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/codex`, changeFrequency: "weekly", priority: 0.7 },
  ];
}

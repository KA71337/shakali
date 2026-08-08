import type { MetadataRoute } from "next";

const fallbackSiteUrl = "http://localhost:3000";

function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();

  if (!configuredUrl) {
    return new URL(fallbackSiteUrl);
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", getSiteUrl()).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

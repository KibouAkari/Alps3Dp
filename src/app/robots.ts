import type { MetadataRoute } from "next";

import { getAppBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/account", "/checkout"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private and operational surfaces stay out of the index.
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/data-room/status",
        "/data-room/access-control",
        "/data-room/akanil",
        "/data-room/atlas-mining",
        "/data-room/hyrion",
        "/data-room/zyntra",
        "/data-room/qassas",
        "/data-room/amusnaw-ai",
        "/data-room/sustainability",
        "/data-room/general",
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}

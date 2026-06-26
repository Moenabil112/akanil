import type { MetadataRoute } from "next";
import { SITE, NAV } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/zyntra/qassas", ...NAV.map((n) => n.href)];
  const unique = Array.from(new Set(routes));
  const now = new Date();

  return unique.map((path) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
